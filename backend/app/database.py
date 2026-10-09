import json
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from .config import DB_PATH
from .lookups import FRIENDLY_NODE_NAMES, lookup_registry
from .time_utils import map_incident_datetime


def detect_evidence_conflicts(
    observations: List[Dict[str, Any]],
    manual_evidence: Dict[str, str],
) -> List[Dict[str, Any]]:
    """
    Detect contradictions across reviewed observations and graph evidence.
    Example: 'Forced entry reported' (entry_method=F) vs. 'No force documented' (entry_method=N),
    or 'No Property Loss (property_loss=1)' vs. 'Property Stolen Logged (property_stolen=Yes)'.
    """
    conflicts: List[Dict[str, Any]] = []
    node_assertions: Dict[str, List[Dict[str, str]]] = {}

    for obs in observations:
        status = obs.get("status", "Unknown")
        node = obs.get("mapped_node")
        if not node or status == "Unknown":
            continue

        inferred_state: Optional[str] = None
        if status == "Present" and obs.get("present_state"):
            inferred_state = str(obs["present_state"])
        elif status == "Absent" and obs.get("absent_state"):
            inferred_state = str(obs["absent_state"])

        if inferred_state:
            node_assertions.setdefault(node, []).append(
                {
                    "state": inferred_state,
                    "source": f"Observation: {obs.get('label', node)} ({status})",
                }
            )

    # Check if two observations assert different states for the same BN variable
    for node, assertions in node_assertions.items():
        unique_states = {a["state"] for a in assertions}
        if len(unique_states) > 1:
            friendly = FRIENDLY_NODE_NAMES.get(node, node)
            details = "; ".join(
                f"{a['source']} -> {lookup_registry.get_state_info(node, a['state'])['label']} ({a['state']})"
                for a in assertions
            )
            conflicts.append(
                {
                    "id": f"conflict_{node}_obs",
                    "severity": "high",
                    "node": node,
                    "friendly_name": friendly,
                    "title": f"Conflicting Evidence on {friendly}",
                    "description": f"Multiple reviewed observations assign contradictory states to {friendly}: {details}.",
                }
            )

    # Logical cross-variable conflict: property_loss == '1' (None) vs property_stolen == 'Yes'
    eff_ev = dict(manual_evidence)
    for node, assertions in node_assertions.items():
        if assertions:
            eff_ev[node] = assertions[-1]["state"]

    if eff_ev.get("property_loss") == "1" and eff_ev.get("property_stolen") == "Yes":
        conflicts.append(
            {
                "id": "conflict_property_loss_stolen",
                "severity": "medium",
                "node": "property_loss",
                "friendly_name": "Property Loss vs. Property Stolen",
                "title": "Contradiction: 'No Property Loss' with 'Property Stolen = Yes'",
                "description": (
                    "Property Loss Category is set to 'None' (Code 1), but Property Stolen is marked as 'Yes'. "
                    "When items are stolen, Property Loss Category is typically 'Stolen/Etc' (Code 7)."
                ),
            }
        )

    if eff_ev.get("attempt_completed") == "A" and eff_ev.get("property_stolen") == "Yes":
        conflicts.append(
            {
                "id": "conflict_attempt_stolen",
                "severity": "medium",
                "node": "attempt_completed",
                "friendly_name": "Offense Completion vs. Property Stolen",
                "title": "Potential Conflict: Attempted Burglary with Stolen Property",
                "description": (
                    "Offense is marked as 'Attempted' (A), yet stolen property is logged ('Yes'). "
                    "Verify whether the unlawful entry and theft constitute a 'Completed' (C) burglary."
                ),
            }
        )

    return conflicts


def build_demo_cases() -> List[Dict[str, Any]]:
    now_iso = datetime.now(timezone.utc).isoformat()
    return [
        {
            "id": "demo-residential-night",
            "case_number": "NY-2025-309261649",
            "title": "Late-Night Forced Residential Burglary (Real Incident #309261649)",
            "summary": (
                "Investigator-documented residential break-in during late night hours. "
                "Pry marks on rear patio door indicate forced entry; household electronics reported stolen."
            ),
            "incident_date": "2026-10-09",
            "incident_time": "02:15",
            "time_precision": "Exact",
            "time_range_start": None,
            "time_range_end": None,
            "range_resolution": None,
            "location": "35",
            "address_notes": "Single-family residence, rear patio entrance",
            "victims": [
                {
                    "id": "vic-1",
                    "label": "Primary Homeowner (Victim #1)",
                    "victim_type": "4",
                    "victim_age_group": "Young_Adult",
                    "victim_sex": "M",
                    "victim_ethnicity": "20",
                    "resident_status": "R",
                    "notes": "Permanent resident present in locality; reported break-in at 02:30.",
                }
            ],
            "suspects": [
                {
                    "id": "sus-1",
                    "label": "Unidentified Intruder (Suspect #1)",
                    "relationship": "24.0",
                    "offender_age_group": "Adult",
                    "offender_sex": "M",
                    "offender_ethnicity": "20",
                    "notes": "No known prior relationship to homeowner (Stranger).",
                }
            ],
            "evidence_files": [
                {
                    "id": "ev-file-1",
                    "filename": "rear_patio_pry_marks_macro.jpg",
                    "category": "Scene Photo",
                    "mime_type": "image/jpeg",
                    "size_bytes": 1843200,
                    "status": "Processed",
                    "uploaded_at": now_iso,
                    "notes": "High-resolution photograph of striker plate tool marks on rear door.",
                },
                {
                    "id": "ev-file-2",
                    "filename": "latent_lift_card_04A.png",
                    "category": "Fingerprint",
                    "mime_type": "image/png",
                    "size_bytes": 642110,
                    "status": "Uploaded",
                    "uploaded_at": now_iso,
                    "notes": "Latent print lifted from interior glass pane (stored for lab comparison).",
                },
            ],
            "observations": [
                {
                    "id": "obs-1",
                    "label": "Forced Entry Tool / Pry Marks on Door Frame",
                    "category": "Physical Access",
                    "status": "Present",
                    "mapped_node": "entry_method",
                    "present_state": "F",
                    "absent_state": "N",
                    "source_type": "Investigator-entered",
                    "notes": "Splintered jamb and deformed deadbolt strike plate.",
                },
                {
                    "id": "obs-2",
                    "label": "Unlocked / Unforced Entry Point Documented",
                    "category": "Physical Access",
                    "status": "Absent",
                    "mapped_node": "entry_method",
                    "present_state": "N",
                    "absent_state": "F",
                    "source_type": "Investigator-entered",
                    "notes": "All other ground-floor windows were locked from inside.",
                },
                {
                    "id": "obs-3",
                    "label": "Stolen Household Property Inventory Logged",
                    "category": "Property",
                    "status": "Present",
                    "mapped_node": "property_stolen",
                    "present_state": "Yes",
                    "absent_state": "Unknown",
                    "source_type": "Investigator-entered",
                    "notes": "Laptop and jewelry box missing from master bedroom.",
                },
            ],
            "manual_evidence": {
                "incident_month": "10",
                "day_type": "Weekday",
                "time_period": "Night",
                "location": "35",
                "entry_method": "F",
                "victim_type": "4",
                "victim_age_group": "Young_Adult",
                "victim_sex": "M",
                "resident_status": "R",
                "relationship": "24.0",
                "property_stolen": "Yes",
            },
            "query_var": "attempt_completed",
            "created_at": now_iso,
            "updated_at": now_iso,
        },
        {
            "id": "demo-commercial-afternoon",
            "case_number": "NY-2025-309480851",
            "title": "Afternoon Non-Forced Office Suite Burglary (Scenario 2 Preset)",
            "summary": (
                "Unforced afternoon entry into a commercial office building between 13:15 and 15:45. "
                "Side service door latch was propped open; office equipment targeted."
            ),
            "incident_date": "2026-05-14",
            "incident_time": "14:20",
            "time_precision": "Approximate",
            "time_range_start": "13:15",
            "time_range_end": "15:45",
            "range_resolution": None,
            "location": "11",
            "address_notes": "Commercial office suite, 3rd floor corridor",
            "victims": [
                {
                    "id": "vic-comm-1",
                    "label": "Tenant Business Entity",
                    "victim_type": "1",
                    "victim_age_group": "Unknown",
                    "victim_sex": "X",
                    "victim_ethnicity": "50",
                    "resident_status": "Unknown",
                    "notes": "Commercial business victim (non-individual).",
                }
            ],
            "suspects": [
                {
                    "id": "sus-comm-1",
                    "label": "Unknown Suspect",
                    "relationship": "Unknown",
                    "offender_age_group": "Unknown",
                    "offender_sex": "U",
                    "offender_ethnicity": "40",
                    "notes": "Suspect attributes unknown pending CCTV review.",
                }
            ],
            "evidence_files": [
                {
                    "id": "ev-comm-1",
                    "filename": "lobby_corridor_cam2_1315_1545.mp4",
                    "category": "CCTV Video",
                    "mime_type": "video/mp4",
                    "size_bytes": 24510200,
                    "status": "Uploaded",
                    "uploaded_at": now_iso,
                    "notes": "Corridor video export covering 13:15 to 15:45 window.",
                }
            ],
            "observations": [
                {
                    "id": "obs-comm-1",
                    "label": "Unforced Entry via Unsecured Service Latch",
                    "category": "Physical Access",
                    "status": "Present",
                    "mapped_node": "entry_method",
                    "present_state": "N",
                    "absent_state": "F",
                    "source_type": "Investigator-entered",
                    "notes": "No lock damage or tool marks found on suite door.",
                }
            ],
            "manual_evidence": {
                "incident_month": "5",
                "day_type": "Weekday",
                "time_period": "Afternoon",
                "location": "11",
                "entry_method": "N",
                "victim_type": "1",
            },
            "query_var": "attempt_completed",
            "created_at": now_iso,
            "updated_at": now_iso,
        },
        {
            "id": "demo-spanning-conflict",
            "case_number": "NY-2025-309512004",
            "title": "Overnight Grocery Store Break-In (Multi-Period Range & Conflict Demo)",
            "summary": (
                "Incident discovered at opening (07:20) after store was closed at 04:45. "
                "The approximate window (04:45–07:15) spans Night and Morning periods, and initial witness statements "
                "conflict with physical lock inspection."
            ),
            "incident_date": "2026-07-19",
            "incident_time": None,
            "time_precision": "Approximate",
            "time_range_start": "04:45",
            "time_range_end": "07:15",
            "range_resolution": "compare",
            "location": "24",
            "address_notes": "Neighborhood grocery & supermarket loading bay",
            "victims": [
                {
                    "id": "vic-groc-1",
                    "label": "Store Proprietor",
                    "victim_type": "1",
                    "victim_age_group": "Unknown",
                    "victim_sex": "X",
                    "victim_ethnicity": "50",
                    "resident_status": "Unknown",
                    "notes": "Commercial grocery store entity.",
                }
            ],
            "suspects": [],
            "evidence_files": [
                {
                    "id": "ev-groc-1",
                    "filename": "incident_initial_field_report.pdf",
                    "category": "Forensic Document",
                    "mime_type": "application/pdf",
                    "size_bytes": 412900,
                    "status": "Processed",
                    "uploaded_at": now_iso,
                    "notes": "Initial patrol response report and lock inspection checklist.",
                }
            ],
            "observations": [
                {
                    "id": "obs-groc-1",
                    "label": "Initial Caller Reported Forced Rear Door",
                    "category": "Witness Statement",
                    "status": "Present",
                    "mapped_node": "entry_method",
                    "present_state": "F",
                    "absent_state": "N",
                    "source_type": "Investigator-entered",
                    "notes": "Store clerk initially assumed rear door was pried open.",
                },
                {
                    "id": "obs-groc-2",
                    "label": "Forensic Lock Inspection: No Force / Keyed Access",
                    "category": "Physical Access",
                    "status": "Present",
                    "mapped_node": "entry_method",
                    "present_state": "N",
                    "absent_state": "F",
                    "source_type": "Uploaded evidence",
                    "notes": "Cylinder examination showed zero tool marks; latch opened cleanly.",
                },
            ],
            "manual_evidence": {
                "incident_month": "7",
                "day_type": "Weekend",
                "location": "24",
                "victim_type": "1",
            },
            "query_var": "attempt_completed",
            "created_at": now_iso,
            "updated_at": now_iso,
        },
    ]


class CaseDatabase:
    """SQLite persistence for investigator cases, people, uploaded evidence, and observations."""

    def __init__(self) -> None:
        self._init_db()
        self._seed_demos_if_empty()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(DB_PATH))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cases (
                    id TEXT PRIMARY KEY,
                    case_number TEXT NOT NULL,
                    title TEXT NOT NULL,
                    data_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _seed_demos_if_empty(self) -> None:
        with self._get_conn() as conn:
            count = conn.execute("SELECT COUNT(*) as c FROM cases").fetchone()["c"]
            if count == 0:
                for demo in build_demo_cases():
                    self._save_case_dict(conn, demo)
                conn.commit()

    def _enrich_case(self, case_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Compute live time_mapping and evidence conflict flags on every case load/save."""
        try:
            time_info = map_incident_datetime(
                incident_date=case_dict.get("incident_date"),
                incident_time=case_dict.get("incident_time"),
                time_precision=case_dict.get("time_precision") or "Exact",
                time_range_start=case_dict.get("time_range_start"),
                time_range_end=case_dict.get("time_range_end"),
                range_resolution=case_dict.get("range_resolution"),
            )
        except ValueError as e:
            time_info = {
                "investigator_entered": {
                    "incident_date": case_dict.get("incident_date"),
                    "incident_time": case_dict.get("incident_time"),
                    "time_precision": case_dict.get("time_precision") or "Time Unknown",
                    "time_range_start": case_dict.get("time_range_start"),
                    "time_range_end": case_dict.get("time_range_end"),
                    "formatted_display": "Invalid or Incomplete Date/Time",
                    "label": "Investigator-entered",
                },
                "model_mapping": {
                    "error": str(e),
                    "bn_evidence": {},
                    "spans_multiple_periods": False,
                    "spanned_periods": [],
                    "candidate_scenarios": [],
                    "model_note": "The model uses 6-hour time periods.",
                },
            }

        case_dict["time_mapping"] = time_info
        case_dict["conflicts"] = detect_evidence_conflicts(
            case_dict.get("observations") or [],
            case_dict.get("manual_evidence") or {},
        )
        return case_dict

    def _save_case_dict(self, conn: sqlite3.Connection, case_dict: Dict[str, Any]) -> Dict[str, Any]:
        enriched = self._enrich_case(case_dict)
        now_iso = datetime.now(timezone.utc).isoformat()
        if not enriched.get("created_at"):
            enriched["created_at"] = now_iso
        enriched["updated_at"] = now_iso

        conn.execute(
            """
            INSERT INTO cases (id, case_number, title, data_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                case_number = excluded.case_number,
                title = excluded.title,
                data_json = excluded.data_json,
                updated_at = excluded.updated_at
            """,
            (
                enriched["id"],
                enriched["case_number"],
                enriched["title"],
                json.dumps(enriched),
                enriched["created_at"],
                enriched["updated_at"],
            ),
        )
        return enriched

    def list_cases(self) -> List[Dict[str, Any]]:
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT data_json FROM cases ORDER BY updated_at DESC"
            ).fetchall()
            return [self._enrich_case(json.loads(r["data_json"])) for r in rows]

    def get_case(self, case_id: str) -> Optional[Dict[str, Any]]:
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT data_json FROM cases WHERE id = ?", (case_id,)
            ).fetchone()
            if not row:
                return None
            return self._enrich_case(json.loads(row["data_json"]))

    def create_or_update_case(
        self, payload: Dict[str, Any], case_id: Optional[str] = None
    ) -> Dict[str, Any]:
        cid = case_id or payload.get("id") or f"case-{uuid.uuid4().hex[:8]}"
        existing = self.get_case(cid) or {}

        merged: Dict[str, Any] = {
            "id": cid,
            "case_number": payload.get("case_number")
            or existing.get("case_number")
            or f"NY-2026-{cid[-4:].upper()}",
            "title": payload.get("title") or existing.get("title") or "Untitled Case",
            "summary": payload.get("summary", existing.get("summary", "")),
            "incident_date": payload.get("incident_date", existing.get("incident_date", "2026-10-09")),
            "incident_time": payload.get("incident_time", existing.get("incident_time", "19:35")),
            "time_precision": payload.get("time_precision", existing.get("time_precision", "Exact")),
            "time_range_start": payload.get("time_range_start", existing.get("time_range_start")),
            "time_range_end": payload.get("time_range_end", existing.get("time_range_end")),
            "range_resolution": payload.get("range_resolution", existing.get("range_resolution")),
            "location": payload.get("location", existing.get("location", "35")),
            "address_notes": payload.get("address_notes", existing.get("address_notes", "")),
            "victims": payload.get("victims", existing.get("victims", [])),
            "suspects": payload.get("suspects", existing.get("suspects", [])),
            "evidence_files": payload.get("evidence_files", existing.get("evidence_files", [])),
            "observations": payload.get("observations", existing.get("observations", [])),
            "manual_evidence": payload.get("manual_evidence", existing.get("manual_evidence", {})),
            "query_var": payload.get("query_var", existing.get("query_var", "attempt_completed")),
            "created_at": existing.get("created_at"),
        }

        # Validate date/time input before saving
        map_incident_datetime(
            incident_date=merged["incident_date"],
            incident_time=merged["incident_time"],
            time_precision=merged["time_precision"],
            time_range_start=merged["time_range_start"],
            time_range_end=merged["time_range_end"],
            range_resolution=merged["range_resolution"],
        )

        with self._get_conn() as conn:
            saved = self._save_case_dict(conn, merged)
            conn.commit()
            return saved

    def delete_case(self, case_id: str) -> bool:
        with self._get_conn() as conn:
            cur = conn.execute("DELETE FROM cases WHERE id = ?", (case_id,))
            conn.commit()
            return cur.rowcount > 0

    def add_evidence_file(self, case_id: str, file_record: Dict[str, Any]) -> Dict[str, Any]:
        case_obj = self.get_case(case_id)
        if not case_obj:
            raise ValueError(f"Case '{case_id}' not found.")
        files = list(case_obj.get("evidence_files") or [])
        files.append(file_record)
        case_obj["evidence_files"] = files
        with self._get_conn() as conn:
            saved = self._save_case_dict(conn, case_obj)
            conn.commit()
            return saved

    def remove_evidence_file(self, case_id: str, evidence_id: str) -> Dict[str, Any]:
        case_obj = self.get_case(case_id)
        if not case_obj:
            raise ValueError(f"Case '{case_id}' not found.")
        files = [
            f for f in (case_obj.get("evidence_files") or []) if f.get("id") != evidence_id
        ]
        case_obj["evidence_files"] = files
        with self._get_conn() as conn:
            saved = self._save_case_dict(conn, case_obj)
            conn.commit()
            return saved

    def load_demo_case(self, demo_id: str) -> Dict[str, Any]:
        demos = {d["id"]: d for d in build_demo_cases()}
        if demo_id not in demos:
            raise ValueError(
                f"Unknown demo case '{demo_id}'. Available demo IDs: {', '.join(demos.keys())}."
            )
        demo_copy = dict(demos[demo_id])
        with self._get_conn() as conn:
            saved = self._save_case_dict(conn, demo_copy)
            conn.commit()
            return saved


case_db = CaseDatabase()
