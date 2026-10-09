import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import UPLOADS_DIR
from .bn_engine import bn_engine, PERSISTENT_NOTICE
from .hmm_engine import hmm_engine, HMM_SCOPE_NOTICE
from .time_utils import map_incident_datetime
from .database import case_db, build_demo_cases
from .lookups import FRIENDLY_NODE_NAMES, lookup_registry
from .schemas import (
    InferRequest,
    ScenarioCompareRequest,
    SensitivityRequest,
    HMMEstimateRequest,
    TimeMapRequest,
    CaseSaveRequest,
)

app = FastAPI(
    title="Probabilistic Crime Scene Reconstruction API",
    description="Bayesian Network (pgmpy VariableElimination & Gibbs Sampling) and Hidden Markov Model backend for NY-2025 Burglary Reconstruction.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return friendly 422 validation error messages instead of raw tracebacks."""
    messages = []
    for err in exc.errors():
        loc = " -> ".join(str(x) for x in err.get("loc", []) if x != "body")
        msg = err.get("msg", "Invalid value")
        messages.append(f"{loc}: {msg}" if loc else msg)
    friendly = "; ".join(messages) if messages else "Invalid input data."
    return JSONResponse(
        status_code=422,
        content={
            "detail": friendly,
            "message": friendly,
            "errors": exc.errors(),
        },
    )


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "bn_nodes": len(bn_engine.nodes),
        "bn_edges": len(bn_engine.edges),
        "is_dag": bn_engine.is_dag(),
        "hmm_states": hmm_engine.n_states,
    }


@app.get("/api/graph")
def get_graph():
    """Return all 20 BN nodes, 19 directed edges, groups, states, friendly names, and priors."""
    return bn_engine.get_graph_metadata()


@app.post("/api/infer")
def run_inference(req: InferRequest):
    """Run Exact (VariableElimination) and/or Approximate (Gibbs Sampling) inference."""
    try:
        return bn_engine.infer(
            evidence=req.evidence,
            query_vars=req.query_vars,
            method=req.method,
            samples=req.samples,
            seed=req.seed,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/scenarios/compare")
def compare_scenarios(req: ScenarioCompareRequest):
    """Compare 2 to 4 candidate scenarios side-by-side on a target query variable."""
    try:
        scenarios_dicts = [
            {"name": s.name, "evidence": s.evidence} for s in req.scenarios
        ]
        return bn_engine.compare_scenarios(
            scenarios=scenarios_dicts,
            query_var=req.query_var,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/api/scenarios/presets")
def get_preset_scenarios():
    """Return the preset scenarios from scenario_inference.py.py."""
    return {
        "presets": bn_engine.get_preset_scenarios(),
        "notice": PERSISTENT_NOTICE,
    }


@app.post("/api/sensitivity")
def get_sensitivity(req: SensitivityRequest):
    """Rank unobserved nodes by how much observing them would shift the query variable's posterior."""
    try:
        return bn_engine.compute_sensitivity(
            query_var=req.query_var,
            evidence=req.evidence,
            top_k=req.top_k,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/api/cpd/{node}")
def get_node_cpd(node: str):
    """Return the learned Conditional Probability Distribution (CPD) table for a node."""
    try:
        return bn_engine.get_cpd_table(node)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/hmm")
def get_hmm_overview():
    """Return HMM hidden states, transition matrix, and 12x4 month x time-period grid."""
    return hmm_engine.get_overview()


@app.post("/api/hmm/estimate")
def estimate_hmm_cell(req: HMMEstimateRequest):
    """Return the HMM hidden-state estimate and regional activity explanation for (month, time_period)."""
    try:
        return hmm_engine.estimate_cell(month=req.month, time_period=req.time_period)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/api/time/map")
def map_time(req: TimeMapRequest):
    """Validate and map investigator-entered date/time/precision/range to BN variables."""
    try:
        return map_incident_datetime(
            incident_date=req.incident_date,
            incident_time=req.incident_time,
            time_precision=req.time_precision,
            time_range_start=req.time_range_start,
            time_range_end=req.time_range_end,
            range_resolution=req.range_resolution,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/api/cases")
def list_cases():
    return {"cases": case_db.list_cases()}


@app.get("/api/cases/demos")
def list_demo_cases():
    return {"demos": build_demo_cases()}


@app.post("/api/cases/demo/{demo_id}")
def load_demo_case(demo_id: str):
    try:
        return case_db.load_demo_case(demo_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/cases")
def create_case(req: CaseSaveRequest):
    try:
        payload = req.model_dump()
        if payload.get("manual_evidence"):
            payload["manual_evidence"] = bn_engine.validate_evidence(payload["manual_evidence"])
        return case_db.create_or_update_case(payload)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/api/cases/{case_id}")
def get_case(case_id: str):
    c = case_db.get_case(case_id)
    if not c:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    return c


@app.put("/api/cases/{case_id}")
def update_case(case_id: str, req: CaseSaveRequest):
    try:
        payload = req.model_dump()
        if payload.get("manual_evidence"):
            payload["manual_evidence"] = bn_engine.validate_evidence(payload["manual_evidence"])
        return case_db.create_or_update_case(payload, case_id=case_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.delete("/api/cases/{case_id}")
def delete_case(case_id: str):
    deleted = case_db.delete_case(case_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    return {"deleted": True, "id": case_id}


@app.post("/api/cases/{case_id}/evidence")
async def upload_case_evidence(
    case_id: str,
    file: UploadFile = File(...),
    category: str = Form("Scene Photo"),
    status: str = Form("Uploaded"),
    notes: str = Form(""),
):
    """Upload and store an evidence file (fingerprint, CCTV video, photo, document) linked to a case."""
    case_obj = case_db.get_case(case_id)
    if not case_obj:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    valid_statuses = {"Uploaded", "Processed", "Failed"}
    if status not in valid_statuses:
        status = "Uploaded"

    content = await file.read()
    size_bytes = len(content)
    ev_id = f"ev-{uuid.uuid4().hex[:8]}"
    safe_name = (file.filename or "evidence_file").replace("/", "_").replace("\\", "_")
    case_upload_dir = UPLOADS_DIR / case_id
    case_upload_dir.mkdir(parents=True, exist_ok=True)
    dest_path = case_upload_dir / f"{ev_id}_{safe_name}"
    dest_path.write_bytes(content)

    record = {
        "id": ev_id,
        "filename": safe_name,
        "category": category,
        "mime_type": file.content_type or "application/octet-stream",
        "size_bytes": size_bytes,
        "status": status,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "notes": notes,
        "source_label": "Uploaded evidence",
    }

    updated_case = case_db.add_evidence_file(case_id, record)
    return {"evidence": record, "case": updated_case}


@app.delete("/api/cases/{case_id}/evidence/{evidence_id}")
def delete_case_evidence(case_id: str, evidence_id: str):
    try:
        updated_case = case_db.remove_evidence_file(case_id, evidence_id)
        return {"deleted": True, "case": updated_case}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/cases/{case_id}/report")
def get_case_report(case_id: str):
    """Generate a complete forensic reconstruction report for PDF/JSON export."""
    case_obj = case_db.get_case(case_id)
    if not case_obj:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    raw_evidence = dict(case_obj.get("manual_evidence") or {})
    clean_evidence = bn_engine.validate_evidence(raw_evidence)
    q_var = case_obj.get("query_var") or "attempt_completed"

    inf_result = bn_engine.infer(
        evidence=clean_evidence,
        query_vars=[
            "attempt_completed",
            "entry_method",
            "property_loss",
            "relationship",
            "offender_age_group",
            "offender_sex",
        ],
        method="exact",
    )

    sens_result = bn_engine.compute_sensitivity(
        query_var=q_var,
        evidence=clean_evidence,
        top_k=5,
    )

    time_map = case_obj.get("time_mapping") or {}
    model_map = time_map.get("model_mapping") or {}
    month_str = clean_evidence.get("incident_month") or model_map.get("incident_month") or "10"
    period_str = clean_evidence.get("time_period") or model_map.get("time_period") or "Unknown"

    try:
        hmm_est = hmm_engine.estimate_cell(int(month_str), period_str)
    except Exception:
        hmm_est = None

    evidence_summary = [
        {
            "node": k,
            "friendly_name": FRIENDLY_NODE_NAMES.get(k, k),
            "state": v,
            "state_label": lookup_registry.get_state_info(k, v)["label"],
            "source_label": "Investigator-entered",
        }
        for k, v in clean_evidence.items()
    ]

    unobserved_nodes = [
        {
            "node": n,
            "friendly_name": FRIENDLY_NODE_NAMES.get(n, n),
            "top_estimate": inf_result["nodes"][n]["top_state"],
            "entropy": inf_result["nodes"][n]["entropy"],
            "source_label": "Model estimate",
        }
        for n in bn_engine.nodes
        if n not in clean_evidence
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "case": case_obj,
        "investigator_timestamp": time_map.get("investigator_entered"),
        "model_time_mapping": model_map,
        "evidence_summary": evidence_summary,
        "conflicts": case_obj.get("conflicts") or [],
        "key_estimates": inf_result["query_results"],
        "unobserved_estimates": unobserved_nodes,
        "sensitivity_ranking": sens_result["rankings"],
        "hmm_regional_context": hmm_est,
        "notices": {
            "bn_notice": PERSISTENT_NOTICE,
            "hmm_notice": HMM_SCOPE_NOTICE,
            "time_note": "The model uses 6-hour time periods.",
            "media_note": "Uploaded media files are stored with the case record and are not automatically analysed by the probabilistic model.",
        },
    }


# Serve built frontend static files when frontend/dist exists
from fastapi.staticfiles import StaticFiles
from .config import WORKSPACE_DIR

_FRONTEND_DIST = WORKSPACE_DIR / "frontend" / "dist"
if _FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(_FRONTEND_DIST), html=True), name="frontend")

