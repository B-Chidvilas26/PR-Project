from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class InferRequest(BaseModel):
    evidence: Dict[str, str] = Field(default_factory=dict)
    query_vars: Optional[List[str]] = Field(
        default=None,
        description="Optional list of query variables to highlight",
    )
    method: str = Field(
        default="exact",
        description="Inference method: 'exact', 'gibbs', or 'both'",
    )
    samples: int = Field(
        default=5000,
        ge=100,
        le=25000,
        description="Number of retained Gibbs samples when method is 'gibbs' or 'both'",
    )
    seed: int = Field(default=42, description="Random seed for reproducible Gibbs sampling")


class ScenarioItem(BaseModel):
    name: str
    evidence: Dict[str, str] = Field(default_factory=dict)


class ScenarioCompareRequest(BaseModel):
    scenarios: List[ScenarioItem]
    query_var: str = Field(default="attempt_completed")


class SensitivityRequest(BaseModel):
    evidence: Dict[str, str] = Field(default_factory=dict)
    query_var: str = Field(default="attempt_completed")
    top_k: int = Field(default=8, ge=1, le=20)


class HMMEstimateRequest(BaseModel):
    month: int = Field(..., ge=1, le=12)
    time_period: Optional[str] = Field(default="Night")


class TimeMapRequest(BaseModel):
    incident_date: Optional[str] = Field(default="2026-10-09")
    incident_time: Optional[str] = Field(default="19:35")
    time_precision: str = Field(default="Exact")
    time_range_start: Optional[str] = Field(default=None)
    time_range_end: Optional[str] = Field(default=None)
    range_resolution: Optional[str] = Field(default=None)


class CaseSaveRequest(BaseModel):
    id: Optional[str] = None
    case_number: Optional[str] = None
    title: str = Field(default="Untitled Case")
    summary: Optional[str] = ""
    incident_date: Optional[str] = "2026-10-09"
    incident_time: Optional[str] = "19:35"
    time_precision: str = "Exact"
    time_range_start: Optional[str] = None
    time_range_end: Optional[str] = None
    range_resolution: Optional[str] = None
    location: Optional[str] = "35"
    address_notes: Optional[str] = ""
    victims: List[Dict[str, Any]] = Field(default_factory=list)
    suspects: List[Dict[str, Any]] = Field(default_factory=list)
    evidence_files: List[Dict[str, Any]] = Field(default_factory=list)
    observations: List[Dict[str, Any]] = Field(default_factory=list)
    manual_evidence: Dict[str, str] = Field(default_factory=dict)
    query_var: Optional[str] = "attempt_completed"
