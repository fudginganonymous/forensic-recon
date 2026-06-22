"""
Pydantic schemas for ReconstructionSession and the five workflow stages:
Observation, Hypothesis, EvidenceHypothesisLink, AlternativeAcknowledgement,
FinalReconstruction.
"""
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field


# ---------- Session ----------

class SessionCreate(BaseModel):
    case_id: int


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    participant_id: int
    case_id: int
    current_stage: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    bayesian_enabled_snapshot: bool


# ---------- Stage 1: Observation ----------

class ObservationCreate(BaseModel):
    observation_text: str = Field(..., min_length=1)
    source: str = Field(..., min_length=1)
    observed_timestamp: Optional[datetime] = None


class ObservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    observation_text: str
    source: str
    observed_timestamp: Optional[datetime] = None
    created_at: datetime


# ---------- Stage 2: Hypothesis ----------

class HypothesisCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    initial_confidence: float = Field(..., ge=0, le=100)
    bayesian_prior: Optional[float] = Field(None, ge=0, le=1)


class HypothesisUpdate(BaseModel):
    """Used for revisions (Stage 2-4). At least one field required."""
    description: Optional[str] = None
    current_confidence: Optional[float] = Field(None, ge=0, le=100)
    rationale: Optional[str] = None


class HypothesisAbandon(BaseModel):
    abandon: bool = True


class HypothesisOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    title: str
    description: str
    initial_confidence: float
    current_confidence: float
    abandoned_at: Optional[datetime] = None
    is_retained_at_final: bool
    bayesian_prior: Optional[float] = None
    created_at: datetime


class HypothesisRevisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hypothesis_id: int
    previous_confidence: float
    new_confidence: float
    rationale: Optional[str] = None
    created_at: datetime


# ---------- Stage 3: Evidence-Hypothesis Links ----------

StanceLiteral = Literal["supports", "weakly_supports", "neutral", "weakly_contradicts", "contradicts"]


class EvidenceLinkCreate(BaseModel):
    evidence_item_id: int
    hypothesis_id: int
    stance: StanceLiteral
    likelihood_ratio: Optional[float] = Field(None, gt=0)


class EvidenceLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    evidence_item_id: int
    hypothesis_id: int
    stance: str
    stance_value: float
    likelihood_ratio: Optional[float] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class EvidenceReviewStatus(BaseModel):
    """
    Returned by GET /sessions/{id}/evidence-review-status to help the
    frontend enforce "Require all evidence items to be reviewed" before
    allowing progression to Stage 4.
    """
    total_evidence_items: int
    reviewed_evidence_items: int
    unreviewed_evidence_item_ids: List[int]
    all_reviewed: bool


# ---------- Stage 4: Alternative Hypothesis Review ----------

class AlternativeReviewItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    item_type: str
    hypothesis_id: Optional[int] = None
    evidence_item_id: Optional[int] = None
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    reflection_note: Optional[str] = None
    created_at: datetime


class AcknowledgeRequest(BaseModel):
    reflection_note: Optional[str] = None


# ---------- Stage 5: Final Reconstruction ----------

class FinalReconstructionCreate(BaseModel):
    selected_hypothesis_id: int
    final_narrative: str = Field(..., min_length=1)
    final_confidence: float = Field(..., ge=0, le=100)


class FinalReconstructionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    selected_hypothesis_id: int
    final_narrative: str
    final_confidence: float
    accuracy_score: Optional[float] = None
    scored_at: Optional[datetime] = None
    created_at: datetime


class AccuracyScoreUpdate(BaseModel):
    accuracy_score: float = Field(..., ge=0, le=100)


# ---------- Full session detail (for participant resume / researcher review) ----------

class SessionDetailOut(SessionOut):
    observations: List[ObservationOut] = []
    hypotheses: List[HypothesisOut] = []
    evidence_links: List[EvidenceLinkOut] = []
    acknowledgements: List[AlternativeReviewItemOut] = []
    final_reconstruction: Optional[FinalReconstructionOut] = None
