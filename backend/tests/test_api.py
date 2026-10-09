import pickle
import pytest
from fastapi.testclient import TestClient
from pgmpy.inference import VariableElimination

from app.main import app
from app.config import BN_MODEL_PATH

client = TestClient(app)


def test_graph_structure_20_nodes_19_edges_and_dag():
    """Verify graph has 20 nodes, 19 directed edges, and is a valid DAG."""
    resp = client.get("/api/graph")
    assert resp.status_code == 200
    data = resp.json()
    assert data["node_count"] == 20
    assert data["edge_count"] == 19
    assert data["is_dag"] is True
    assert len(data["nodes"]) == 20
    assert len(data["edges"]) == 19

    # Verify all 5 required groups exist
    group_names = {g["name"] for g in data["groups"]}
    assert group_names == {
        "Time",
        "Incident",
        "Victim",
        "Offender/Relationship",
        "Property",
    }


def test_exact_inference_no_evidence_matches_model_priors():
    """Verify exact inference with empty evidence matches the pgmpy model's priors."""
    with open(BN_MODEL_PATH, "rb") as f:
        raw_model = pickle.load(f)
    ve = VariableElimination(raw_model)

    resp = client.post("/api/infer", json={"evidence": {}, "method": "exact"})
    assert resp.status_code == 200
    nodes_res = resp.json()["nodes"]

    for node in raw_model.nodes():
        expected = ve.query(variables=[node], show_progress=False)
        exp_states = [str(s) for s in expected.state_names[node]]
        exp_map = dict(zip(exp_states, expected.values))

        api_states = {
            item["state"]: item["posterior"] for item in nodes_res[node]["states"]
        }
        for st, exp_val in exp_map.items():
            assert abs(api_states[st] - float(exp_val)) < 1e-5
            # Delta vs prior should be 0 when no evidence is set
            item_obj = next(i for i in nodes_res[node]["states"] if i["state"] == st)
            assert abs(item_obj["delta"]) < 1e-6


def test_scenario_night_forced_matches_original_gibbs_inference_exact_output():
    """
    Verify 'Night + F -> attempt_completed' exact output matches gibbs_inference.py.py
    (Attempted A = 0.040792..., Completed C = 0.959208...).
    """
    resp = client.post(
        "/api/infer",
        json={
            "evidence": {"time_period": "Night", "entry_method": "F"},
            "query_vars": ["attempt_completed"],
            "method": "exact",
        },
    )
    assert resp.status_code == 200
    ac_states = {
        s["state"]: s["posterior"]
        for s in resp.json()["nodes"]["attempt_completed"]["states"]
    }
    assert abs(ac_states["A"] - 0.040792) < 1e-4
    assert abs(ac_states["C"] - 0.959208) < 1e-4


def test_gibbs_sampling_close_to_exact_within_tolerance():
    """
    Verify Gibbs sampling for 'Night + F -> attempt_completed' is close to exact inference
    within tolerance and reproduces gibbs_inference.py.py (0.0374 / 0.9626 with seed=42, samples=5000).
    """
    resp = client.post(
        "/api/infer",
        json={
            "evidence": {"time_period": "Night", "entry_method": "F"},
            "query_vars": ["attempt_completed"],
            "method": "both",
            "samples": 5000,
            "seed": 42,
        },
    )
    assert resp.status_code == 200
    ac_items = {
        s["state"]: s
        for s in resp.json()["nodes"]["attempt_completed"]["states"]
    }
    # Check exact reproduction of gibbs_inference.py.py (A=0.0374, C=0.9626)
    assert abs(ac_items["A"]["gibbs_posterior"] - 0.0374) < 1e-4
    assert abs(ac_items["C"]["gibbs_posterior"] - 0.9626) < 1e-4
    # Check tolerance against exact inference (< 0.02)
    assert ac_items["A"]["abs_error"] < 0.02
    assert ac_items["C"]["abs_error"] < 0.02


def test_invalid_evidence_is_rejected_with_friendly_422():
    """Verify invalid node names or invalid state values return 422 with friendly message."""
    # Invalid state value for entry_method
    resp1 = client.post(
        "/api/infer",
        json={"evidence": {"entry_method": "LASER_CUTTER"}, "method": "exact"},
    )
    assert resp1.status_code == 422
    detail1 = resp1.json()["detail"]
    assert "Method of Entry" in detail1
    assert "F, N" in detail1

    # Invalid variable name
    resp2 = client.post(
        "/api/infer",
        json={"evidence": {"nonexistent_variable": "123"}, "method": "exact"},
    )
    assert resp2.status_code == 422
    assert "Unknown variable" in resp2.json()["detail"]


def test_time_mapping_rules_exact_approximate_spanning_and_unknown():
    """
    Verify all CORE FEATURE 4 time-mapping rules:
    1. Exact time -> derives month, day_type, and 6-hour time_period
    2. Approximate range inside one period -> uses that period
    3. Approximate range spanning multiple periods -> does NOT collapse silently; flags spans_multiple_periods
    4. Time Unknown -> sets time_period to 'Unknown' (or unobserved) without inventing an hour
    5. Invalid time string -> rejected with friendly 422
    """
    # 1. Exact time: 09 Oct 2026 (Friday) at 19:35 -> Month 10, Weekday, Evening
    r_exact = client.post(
        "/api/time/map",
        json={
            "incident_date": "2026-10-09",
            "incident_time": "19:35",
            "time_precision": "Exact",
        },
    )
    assert r_exact.status_code == 200
    d_exact = r_exact.json()
    assert d_exact["investigator_entered"]["formatted_display"] == "09 Oct 2026, 19:35"
    assert d_exact["model_mapping"]["incident_month"] == "10"
    assert d_exact["model_mapping"]["day_type"] == "Weekday"
    assert d_exact["model_mapping"]["time_period"] == "Evening"
    assert d_exact["model_mapping"]["spans_multiple_periods"] is False

    # 2. Approximate range within a single period: 13:15 to 16:45 -> Afternoon
    r_approx_single = client.post(
        "/api/time/map",
        json={
            "incident_date": "2026-10-10",
            "time_precision": "Approximate",
            "time_range_start": "13:15",
            "time_range_end": "16:45",
        },
    )
    assert r_approx_single.status_code == 200
    d_single = r_approx_single.json()
    assert d_single["model_mapping"]["day_type"] == "Weekend"
    assert d_single["model_mapping"]["time_period"] == "Afternoon"
    assert d_single["model_mapping"]["spans_multiple_periods"] is False

    # 3. Approximate range spanning multiple periods: 04:30 to 07:30 -> Night & Morning
    r_span = client.post(
        "/api/time/map",
        json={
            "incident_date": "2026-10-09",
            "time_precision": "Approximate",
            "time_range_start": "04:30",
            "time_range_end": "07:30",
        },
    )
    assert r_span.status_code == 200
    d_span = r_span.json()
    assert d_span["model_mapping"]["spans_multiple_periods"] is True
    assert d_span["model_mapping"]["spanned_periods"] == ["Night", "Morning"]
    # Must NOT collapse silently into a single period
    assert d_span["model_mapping"]["time_period"] is None
    assert len(d_span["model_mapping"]["candidate_scenarios"]) == 2

    # 4. Time Unknown -> sets time_period to 'Unknown'
    r_unk = client.post(
        "/api/time/map",
        json={
            "incident_date": "2026-10-09",
            "time_precision": "Time Unknown",
        },
    )
    assert r_unk.status_code == 200
    d_unk = r_unk.json()
    assert d_unk["investigator_entered"]["incident_time"] is None
    assert d_unk["model_mapping"]["time_period"] == "Unknown"

    # 5. Invalid time string -> 422
    r_bad = client.post(
        "/api/time/map",
        json={
            "incident_date": "2026-10-09",
            "incident_time": "25:99",
            "time_precision": "Exact",
        },
    )
    assert r_bad.status_code == 422


def test_saved_cases_round_trip_with_original_timestamp_intact():
    """Verify saving and loading a case preserves original date, minute-level time, precision, and range."""
    payload = {
        "case_number": "NY-TEST-9901",
        "title": "Round-Trip Timestamp Verification Case",
        "summary": "Testing minute-level investigator timestamp persistence.",
        "incident_date": "2026-10-09",
        "incident_time": "19:35",
        "time_precision": "Approximate",
        "time_range_start": "18:45",
        "time_range_end": "20:15",
        "location": "35",
        "manual_evidence": {"location": "35", "entry_method": "F"},
    }
    create_resp = client.post("/api/cases", json=payload)
    assert create_resp.status_code == 200
    saved = create_resp.json()
    case_id = saved["id"]

    get_resp = client.get(f"/api/cases/{case_id}")
    assert get_resp.status_code == 200
    loaded = get_resp.json()

    assert loaded["incident_date"] == "2026-10-09"
    assert loaded["incident_time"] == "19:35"
    assert loaded["time_precision"] == "Approximate"
    assert loaded["time_range_start"] == "18:45"
    assert loaded["time_range_end"] == "20:15"
    assert (
        loaded["time_mapping"]["investigator_entered"]["formatted_display"]
        == "09 Oct 2026, Approx. 18:45–20:15"
    )
    assert loaded["time_mapping"]["investigator_entered"]["label"] == "Investigator-entered"

    # Clean up test case
    del_resp = client.delete(f"/api/cases/{case_id}")
    assert del_resp.status_code == 200


def test_hmm_and_cpd_and_scenarios_and_sensitivity():
    """Verify HMM endpoints, CPD lookup, scenario comparison, and sensitivity helper."""
    # HMM overview
    hmm_resp = client.get("/api/hmm")
    assert hmm_resp.status_code == 200
    hmm_data = hmm_resp.json()
    assert hmm_data["n_states"] == 3
    assert len(hmm_data["grid"]) == 12

    # HMM cell estimate
    est_resp = client.post("/api/hmm/estimate", json={"month": 10, "time_period": "Evening"})
    assert est_resp.status_code == 200
    est_data = est_resp.json()
    assert est_data["month"] == 10
    assert est_data["time_period"] == "Evening"
    assert est_data["hidden_state"] == 2
    assert est_data["crime_count"] == 455

    # CPD table
    cpd_resp = client.get("/api/cpd/attempt_completed")
    assert cpd_resp.status_code == 200
    cpd_data = cpd_resp.json()
    assert cpd_data["node"] == "attempt_completed"
    assert cpd_data["parents"] == ["entry_method"]
    assert cpd_data["total_columns"] == 2

    # Scenario compare
    comp_resp = client.post(
        "/api/scenarios/compare",
        json={
            "query_var": "attempt_completed",
            "scenarios": [
                {"name": "Night + Forced", "evidence": {"time_period": "Night", "entry_method": "F"}},
                {"name": "Afternoon + Non-Forced", "evidence": {"time_period": "Afternoon", "entry_method": "N"}},
            ],
        },
    )
    assert comp_resp.status_code == 200
    comp_data = comp_resp.json()
    assert len(comp_data["scenarios"]) == 2

    # Sensitivity ranking
    sens_resp = client.post(
        "/api/sensitivity",
        json={"query_var": "attempt_completed", "evidence": {"time_period": "Night"}, "top_k": 5},
    )
    assert sens_resp.status_code == 200
    sens_data = sens_resp.json()
    assert len(sens_data["rankings"]) == 5
    # entry_method is the direct parent of attempt_completed and should be #1 most impactful
    assert sens_data["rankings"][0]["node"] == "entry_method"
