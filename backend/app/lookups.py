from typing import Dict, Any, List
import pandas as pd
from .config import (
    LOOKUP_LOCATION_PATH,
    LOOKUP_VICTIM_TYPE_PATH,
    LOOKUP_RELATIONSHIP_PATH,
    LOOKUP_PROP_LOSS_PATH,
    LOOKUP_ETHNICITY_PATH,
    LOOKUP_CLEARED_EXCEPT_PATH,
)

# 5 Core Groups as specified in CORE FEATURE 1
NODE_GROUPS: Dict[str, str] = {
    "incident_month": "Time",
    "day_type": "Time",
    "time_period": "Time",
    "location": "Incident",
    "entry_method": "Incident",
    "attempt_completed": "Incident",
    "cleared_except_id": "Incident",
    "num_premises_entered": "Incident",
    "victim_type": "Victim",
    "victim_age_group": "Victim",
    "victim_sex": "Victim",
    "victim_ethnicity": "Victim",
    "resident_status": "Victim",
    "relationship": "Offender/Relationship",
    "offender_age_group": "Offender/Relationship",
    "offender_sex": "Offender/Relationship",
    "offender_ethnicity": "Offender/Relationship",
    "property_loss": "Property",
    "property_stolen": "Property",
    "property_recovered": "Property",
}

GROUP_COLORS: Dict[str, str] = {
    "Time": "#3b82f6",                   # Blue
    "Incident": "#ef4444",               # Red/Coral
    "Victim": "#10b981",                 # Emerald
    "Offender/Relationship": "#f59e0b",  # Amber
    "Property": "#8b5cf6",               # Violet
}

FRIENDLY_NODE_NAMES: Dict[str, str] = {
    "incident_month": "Incident Month",
    "day_type": "Day of Week Type",
    "time_period": "Time Period (6-Hour Window)",
    "location": "Scene Location Type",
    "entry_method": "Method of Entry",
    "attempt_completed": "Offense Completion Status",
    "cleared_except_id": "Exceptional Clearance Status",
    "num_premises_entered": "Number of Premises Entered",
    "victim_type": "Victim Category",
    "victim_age_group": "Victim Age Group",
    "victim_sex": "Victim Sex",
    "victim_ethnicity": "Victim Ethnicity",
    "resident_status": "Victim Residency Status",
    "relationship": "Victim–Offender Relationship",
    "offender_age_group": "Suspect / Offender Age Group",
    "offender_sex": "Suspect / Offender Sex",
    "offender_ethnicity": "Suspect / Offender Ethnicity",
    "property_loss": "Property Loss Category",
    "property_stolen": "Property Stolen Recorded",
    "property_recovered": "Property Recovered Recorded",
}

NODE_DESCRIPTIONS: Dict[str, str] = {
    "incident_month": "Calendar month (January through December) in which the burglary incident occurred.",
    "day_type": "Whether the incident date falls on a standard Weekday (Mon–Fri) or Weekend (Sat–Sun).",
    "time_period": "6-hour time window of the incident: Night (00:00–05:59), Morning (06:00–11:59), Afternoon (12:00–17:59), Evening (18:00–23:59), or Unknown.",
    "location": "Primary functional type of the premises or structure where the burglary took place.",
    "entry_method": "Physical manner of entry into the structure: Forced entry (tool marks, broken lock/window) vs. Non-forced entry (unlocked door/window).",
    "attempt_completed": "Whether the burglary was successfully completed or remained an unsuccessful attempt.",
    "cleared_except_id": "Administrative status indicating whether the case was cleared by exceptional means (e.g., prosecution declined, offender deceased, or not applicable).",
    "num_premises_entered": "Total number of distinct premises or units entered during the burglary incident.",
    "victim_type": "Classification of the primary victim (e.g., Individual person, Business, Commercial entity, Government, or Society).",
    "victim_age_group": "Age bracket of the primary victim (Minor <18, Young Adult 18–29, Adult 30–49, Middle Aged 50–64, Senior 65+, or Unknown).",
    "victim_sex": "Recorded biological sex of the primary victim (Female, Male, Unknown, or Not Specified for non-human entities).",
    "victim_ethnicity": "Recorded ethnicity classification of the primary victim.",
    "resident_status": "Whether the victim is a permanent resident of the jurisdiction where the crime occurred.",
    "relationship": "Known prior relationship between the victim and the offender (e.g., Stranger, Acquaintance, Neighbor, Spouse, Ex-Partner).",
    "offender_age_group": "Estimated or recorded age bracket of the primary offender/suspect.",
    "offender_sex": "Recorded or observed sex of the primary offender/suspect.",
    "offender_ethnicity": "Recorded ethnicity classification of the primary offender/suspect.",
    "property_loss": "Primary category of property loss or damage sustained during the incident (e.g., Stolen, Damaged/Vandalized, Recovered, None).",
    "property_stolen": "Indicates whether one or more stolen property items were logged on the incident report.",
    "property_recovered": "Indicates whether any stolen property items were subsequently recovered.",
}

EDGE_DESCRIPTIONS: Dict[str, str] = {
    "incident_month->day_type": "Seasonal calendar distribution influences the proportion of weekday vs. weekend burglary incidents.",
    "day_type->time_period": "Weekday vs. weekend routines shift occupancy patterns and the 6-hour time window when burglaries occur.",
    "time_period->location": "The time of day strongly influences which target locations (e.g., residences vs. commercial buildings) are targeted.",
    "location->entry_method": "The security and physical structure of the location affect whether forced or non-forced entry is used.",
    "entry_method->attempt_completed": "Whether force was used directly impacts the probability that the burglary is completed vs. aborted as an attempt.",
    "attempt_completed->cleared_except_id": "Completion status of the burglary influences downstream administrative clearance outcomes.",
    "attempt_completed->num_premises_entered": "Whether entry was completed affects how many distinct premises or units were entered.",
    "location->victim_type": "The type of premises (e.g., Residence/Home vs. Commercial/Office Building) determines whether the victim is an Individual or Business.",
    "victim_type->victim_age_group": "Victim category determines whether an individual age distribution applies or if age is Unknown/Not Applicable.",
    "victim_age_group->victim_sex": "Demographic distribution of victim sex conditioned on the victim's age group.",
    "victim_age_group->victim_ethnicity": "Demographic distribution of victim ethnicity conditioned on the victim's age group.",
    "victim_age_group->resident_status": "Victim age bracket correlates with local residency status.",
    "victim_type->relationship": "Whether the victim is an individual or organization shapes the possible victim–offender relationship categories.",
    "relationship->offender_age_group": "The nature of the victim–offender relationship informs the likely age bracket of the offender.",
    "relationship->offender_sex": "The victim–offender relationship influences the probability distribution of offender sex.",
    "relationship->offender_ethnicity": "The victim–offender relationship informs the demographic distribution of offender ethnicity.",
    "location->property_loss": "The type of location burgled influences what kind of property loss or damage occurs.",
    "property_loss->property_stolen": "The property loss classification directly determines whether stolen items are recorded.",
    "property_loss->property_recovered": "The property loss classification influences the likelihood that property is recovered.",
}

MONTH_NAMES = {
    "1": "January",
    "2": "February",
    "3": "March",
    "4": "April",
    "5": "May",
    "6": "June",
    "7": "July",
    "8": "August",
    "9": "September",
    "10": "October",
    "11": "November",
    "12": "December",
}

STATIC_STATE_LABELS: Dict[str, Dict[str, Dict[str, str]]] = {
    "incident_month": {
        k: {"label": v, "code": k, "tooltip": f"Month {k} ({v})"}
        for k, v in MONTH_NAMES.items()
    },
    "day_type": {
        "Weekday": {"label": "Weekday (Mon–Fri)", "code": "Weekday", "tooltip": "Monday through Friday"},
        "Weekend": {"label": "Weekend (Sat–Sun)", "code": "Weekend", "tooltip": "Saturday and Sunday"},
    },
    "time_period": {
        "Night": {"label": "Night (00:00–05:59)", "code": "Night", "tooltip": "Hours 0–5 (Midnight to 5:59 AM)"},
        "Morning": {"label": "Morning (06:00–11:59)", "code": "Morning", "tooltip": "Hours 6–11 (6:00 AM to 11:59 AM)"},
        "Afternoon": {"label": "Afternoon (12:00–17:59)", "code": "Afternoon", "tooltip": "Hours 12–17 (12:00 PM to 5:59 PM)"},
        "Evening": {"label": "Evening (18:00–23:59)", "code": "Evening", "tooltip": "Hours 18–23 (6:00 PM to 11:59 PM)"},
        "Unknown": {"label": "Unknown Time Period", "code": "Unknown", "tooltip": "Unrecorded or unknown hour"},
    },
    "entry_method": {
        "F": {"label": "Forced Entry", "code": "F", "tooltip": "Raw Code: F — Force used (broken lock, window, pry marks)"},
        "N": {"label": "Non-Forced Entry", "code": "N", "tooltip": "Raw Code: N — No force used (unlocked door/window, key)"},
    },
    "attempt_completed": {
        "A": {"label": "Attempted Burglary", "code": "A", "tooltip": "Raw Code: A — Attempted (entry or offense not completed)"},
        "C": {"label": "Completed Burglary", "code": "C", "tooltip": "Raw Code: C — Completed burglary"},
    },
    "victim_age_group": {
        "Minor": {"label": "Minor (<18 yrs)", "code": "Minor", "tooltip": "Under 18 years old"},
        "Young_Adult": {"label": "Young Adult (18–29 yrs)", "code": "Young_Adult", "tooltip": "18 to 29 years old"},
        "Adult": {"label": "Adult (30–49 yrs)", "code": "Adult", "tooltip": "30 to 49 years old"},
        "Middle_Aged": {"label": "Middle-Aged (50–64 yrs)", "code": "Middle_Aged", "tooltip": "50 to 64 years old"},
        "Senior": {"label": "Senior (65+ yrs)", "code": "Senior", "tooltip": "65 years and older"},
        "Unknown": {"label": "Unknown / Not Applicable", "code": "Unknown", "tooltip": "Age unrecorded or non-individual victim"},
    },
    "offender_age_group": {
        "Minor": {"label": "Minor (<18 yrs)", "code": "Minor", "tooltip": "Under 18 years old"},
        "Young_Adult": {"label": "Young Adult (18–29 yrs)", "code": "Young_Adult", "tooltip": "18 to 29 years old"},
        "Adult": {"label": "Adult (30–49 yrs)", "code": "Adult", "tooltip": "30 to 49 years old"},
        "Middle_Aged": {"label": "Middle-Aged (50–64 yrs)", "code": "Middle_Aged", "tooltip": "50 to 64 years old"},
        "Senior": {"label": "Senior (65+ yrs)", "code": "Senior", "tooltip": "65 years and older"},
        "Unknown": {"label": "Unknown Age", "code": "Unknown", "tooltip": "Offender age unrecorded or unknown"},
    },
    "victim_sex": {
        "F": {"label": "Female", "code": "F", "tooltip": "Raw Code: F — Female"},
        "M": {"label": "Male", "code": "M", "tooltip": "Raw Code: M — Male"},
        "U": {"label": "Unknown", "code": "U", "tooltip": "Raw Code: U — Unknown sex"},
        "X": {"label": "Not Specified (Non-Individual)", "code": "X", "tooltip": "Raw Code: X — Non-individual entity (e.g., Business)"},
    },
    "offender_sex": {
        "F": {"label": "Female", "code": "F", "tooltip": "Raw Code: F — Female"},
        "M": {"label": "Male", "code": "M", "tooltip": "Raw Code: M — Male"},
        "U": {"label": "Unknown", "code": "U", "tooltip": "Raw Code: U — Unknown sex"},
        "X": {"label": "Not Specified", "code": "X", "tooltip": "Raw Code: X — Not specified"},
    },
    "resident_status": {
        "R": {"label": "Resident", "code": "R", "tooltip": "Raw Code: R — Permanent resident of locality"},
        "N": {"label": "Non-Resident", "code": "N", "tooltip": "Raw Code: N — Non-resident of locality"},
        "U": {"label": "Unknown (Code U)", "code": "U", "tooltip": "Raw Code: U — Recorded as Unknown"},
        "Unknown": {"label": "Unrecorded / Missing", "code": "Unknown", "tooltip": "Raw Value: Unknown — Missing residency record"},
    },
    "property_stolen": {
        "Yes": {"label": "Yes (Stolen Property Logged)", "code": "Yes", "tooltip": "Stolen item count recorded"},
        "Unknown": {"label": "None / Unrecorded", "code": "Unknown", "tooltip": "No stolen item count recorded"},
    },
    "property_recovered": {
        "Yes": {"label": "Yes (Property Recovered)", "code": "Yes", "tooltip": "Recovered item count recorded"},
        "Unknown": {"label": "None / Unrecorded", "code": "Unknown", "tooltip": "No recovered item count recorded"},
    },
}


class LookupRegistry:
    """Loads NIBRS CSV lookup tables and resolves human-readable names and tooltips."""

    def __init__(self) -> None:
        self.state_metadata: Dict[str, Dict[str, Dict[str, str]]] = {
            k: dict(v) for k, v in STATIC_STATE_LABELS.items()
        }
        self._load_csv_lookups()

    def _load_csv_lookups(self) -> None:
        # 1. Location Type
        loc_df = pd.read_csv(LOOKUP_LOCATION_PATH)
        loc_map: Dict[str, Dict[str, str]] = {}
        for _, row in loc_df.iterrows():
            lid = str(int(row["location_id"]))
            lcode = str(row["location_code"]).zfill(2)
            lname = str(row["location_name"])
            loc_map[lid] = {
                "label": lname,
                "code": lid,
                "tooltip": f"Location ID: {lid} (NIBRS Code {lcode}) — {lname}",
            }
        loc_map["Unknown"] = {"label": "Unknown Location", "code": "Unknown", "tooltip": "Unknown location"}
        self.state_metadata["location"] = loc_map

        # 2. Victim Type
        vt_df = pd.read_csv(LOOKUP_VICTIM_TYPE_PATH)
        vt_map: Dict[str, Dict[str, str]] = {}
        for _, row in vt_df.iterrows():
            vid = str(int(row["victim_type_id"]))
            vcode = str(row["victim_type_code"])
            vname = str(row["victim_type_name"])
            vt_map[vid] = {
                "label": vname,
                "code": vid,
                "tooltip": f"Victim Type ID: {vid} (Code {vcode}) — {vname}",
            }
        vt_map["Unknown"] = {"label": "Unknown Victim Type", "code": "Unknown", "tooltip": "Unknown"}
        self.state_metadata["victim_type"] = vt_map

        # 3. Relationship (Note: BN states have float strings like '1.0', '24.0', plus 'Unknown')
        rel_df = pd.read_csv(LOOKUP_RELATIONSHIP_PATH)
        rel_map: Dict[str, Dict[str, str]] = {}
        for _, row in rel_df.iterrows():
            rid_int = int(row["relationship_id"])
            rcode = str(row["relationship_code"])
            rname = str(row["relationship_name"])
            # Support both '1' and '1.0'
            for key in (str(rid_int), f"{rid_int}.0"):
                rel_map[key] = {
                    "label": rname.replace("Victim Was ", "").replace("Victim was ", ""),
                    "code": key,
                    "tooltip": f"Relationship ID: {key} (Code {rcode}) — {rname}",
                }
        rel_map["Unknown"] = {
            "label": "Unknown / Not Recorded",
            "code": "Unknown",
            "tooltip": "Raw Value: Unknown — No relationship record linked",
        }
        self.state_metadata["relationship"] = rel_map

        # 4. Property Loss Type
        pl_df = pd.read_csv(LOOKUP_PROP_LOSS_PATH)
        pl_map: Dict[str, Dict[str, str]] = {}
        for _, row in pl_df.iterrows():
            pid = str(int(row["prop_loss_id"]))
            pname = str(row["prop_loss_name"])
            pdesc = str(row["prop_loss_desc"])
            pl_map[pid] = {
                "label": pname,
                "code": pid,
                "tooltip": f"Property Loss ID: {pid} — {pdesc}",
            }
        pl_map["Unknown"] = {"label": "Unknown", "code": "Unknown", "tooltip": "Unknown"}
        self.state_metadata["property_loss"] = pl_map

        # 5. Ethnicity (for both victim_ethnicity and offender_ethnicity)
        eth_df = pd.read_csv(LOOKUP_ETHNICITY_PATH)
        eth_map: Dict[str, Dict[str, str]] = {}
        for _, row in eth_df.iterrows():
            eid_int = int(row["ethnicity_id"])
            ecode = str(row["ethnicity_code"])
            ename = str(row["ethnicity_name"])
            for key in (str(eid_int), f"{eid_int}.0"):
                eth_map[key] = {
                    "label": ename,
                    "code": key,
                    "tooltip": f"Ethnicity ID: {key} (Code {ecode}) — {ename}",
                }
        eth_map["Unknown"] = {"label": "Unknown Ethnicity", "code": "Unknown", "tooltip": "Unknown"}
        self.state_metadata["victim_ethnicity"] = dict(eth_map)
        self.state_metadata["offender_ethnicity"] = dict(eth_map)

        # 6. Cleared Exceptionally
        ce_df = pd.read_csv(LOOKUP_CLEARED_EXCEPT_PATH)
        ce_map: Dict[str, Dict[str, str]] = {}
        for _, row in ce_df.iterrows():
            cid = str(int(row["cleared_except_id"]))
            ccode = str(row["cleared_except_code"])
            cname = str(row["cleared_except_name"])
            cdesc = str(row["cleared_except_desc"])
            ce_map[cid] = {
                "label": cname,
                "code": cid,
                "tooltip": f"Clearance ID: {cid} (Code {ccode}) — {cdesc}",
            }
        ce_map["Unknown"] = {"label": "Unknown", "code": "Unknown", "tooltip": "Unknown"}
        self.state_metadata["cleared_except_id"] = ce_map

    def get_state_info(self, node: str, state: str) -> Dict[str, str]:
        if node == "num_premises_entered":
            if state == "Unknown":
                return {
                    "label": "Unknown / Unrecorded",
                    "code": "Unknown",
                    "tooltip": "Number of premises entered was not recorded",
                }
            try:
                count_int = int(float(state))
                unit = "Premises / Unit" if count_int == 1 else "Premises / Units"
                return {
                    "label": f"{count_int} {unit}",
                    "code": state,
                    "tooltip": f"Raw state: {state} ({count_int} distinct premises entered)",
                }
            except ValueError:
                pass

        node_map = self.state_metadata.get(node, {})
        if state in node_map:
            return node_map[state]
        return {
            "label": str(state),
            "code": str(state),
            "tooltip": f"Raw value: {state}",
        }


lookup_registry = LookupRegistry()
