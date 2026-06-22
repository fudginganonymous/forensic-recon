"""
Pydantic schemas for SessionMetrics and the Bayesian module.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class SessionMetricsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: int

    num_hypotheses_generated: int
    num_hypothesis_revisions: int
    num_evidence_hypothesis_links: int
    num_alternatives_retained_at_final: int
    num_contradictory_acknowledgements: int
    hypothesis_flexibility_score: Optional[float] = None

    time_to_first_preferred_hypothesis_seconds: Optional[float] = None
    num_hypotheses_abandoned_early: int
    num_contradictory_evidence_ignored: int
    num_evidence_reviewed_before_final: int
    premature_closure_score: Optional[float] = None

    initial_confidence_of_selected: Optional[float] = None
    final_confidence: Optional[float] = None
    final_accuracy: Optional[float] = None
    calibration_error: Optional[float] = None

    computed_at: datetime


# ---------- Bayesian module ----------

class BayesianUpdateRequest(BaseModel):
    """
    Request to (re)compute the posterior probability for a single
    hypothesis, using the likelihood ratios currently recorded on its
    EvidenceHypothesisLinks (Stage 3 data), optionally overriding the
    prior.
    """
    prior_override: Optional[float] = Field(None, ge=0, le=1)


class EvidenceConsideredEntry(BaseModel):
    evidence_item_id: int
    label: str
    stance: str
    likelihood_ratio: float


class BayesianUpdateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hypothesis_id: int
    prior_probability: float
    posterior_probability: float
    evidence_considered: List[EvidenceConsideredEntry]
    created_at: datetime


class BayesianHypothesisSummary(BaseModel):
    """
    Convenience aggregate returned by GET /bayesian/sessions/{id}/summary
    - one entry per hypothesis with its full update trail and latest
    posterior, suitable for plotting probability graphs on the frontend.
    """
    hypothesis_id: int
    hypothesis_title: str
    prior: Optional[float] = None
    latest_posterior: Optional[float] = None
    trail: List[BayesianUpdateOut] = []
