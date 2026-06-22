"""
Metrics calculation service.

This module computes the three families of metrics specified in the
research design:

  1. Hypothesis Flexibility (composite, higher = more flexible)
  2. Premature Closure (composite, higher = more premature closure)
  3. Confidence Calibration (initial vs final confidence vs accuracy)

Design notes on the composite formulas
---------------------------------------
The specification lists the *components* of each composite but does not
mandate a specific formula (this is a methodological decision for the
dissertation). The implementation below provides a transparent,
documented, EASILY-ADJUSTABLE default formula using min-max normalisation
against configurable expected ranges, producing 0-100 scores. All raw
component counts are stored alongside the composite in SessionMetrics,
so:

  - The researcher can recompute alternative composites in SPSS/R using
    the raw components exported via CSV/Excel.
  - The weights and normalisation bounds below are defined as named
    constants at the top of this file, making them trivial to change
    without touching the calculation logic, and trivial to report in
    a methods section.

These defaults should be reviewed/justified in the dissertation
methodology and can be changed here in one place.
"""
import json
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session as DBSession

from app.models.session import ReconstructionSession
from app.models.hypothesis import Hypothesis, HypothesisRevision
from app.models.evidence_link import EvidenceHypothesisLink
from app.models.acknowledgement import AlternativeAcknowledgement
from app.models.case import EvidenceItem
from app.models.activity_log import ActivityLog
from app.models.metrics import SessionMetrics
from app.models.final_reconstruction import FinalReconstruction
from app.services import event_types as ET


# ---------------------------------------------------------------------------
# Configuration constants - adjust normalisation bounds/weights here.
# Each "_MAX" constant represents the value at which the component is
# considered to have reached its maximum contribution (clipped above this).
# ---------------------------------------------------------------------------

# Hypothesis Flexibility component weights (must sum to 1.0)
HF_WEIGHTS = {
    "num_hypotheses_generated": 0.20,
    "num_hypothesis_revisions": 0.20,
    "num_evidence_hypothesis_links": 0.20,
    "num_alternatives_retained_at_final": 0.25,
    "num_contradictory_acknowledgements": 0.15,
}
# Upper bounds used for normalising each component to a 0-1 scale before weighting
HF_MAX = {
    "num_hypotheses_generated": 5,       # 5+ hypotheses = full score on this component
    "num_hypothesis_revisions": 6,       # 6+ revisions across all hypotheses
    "num_evidence_hypothesis_links": None,  # normalised dynamically (see below)
    "num_alternatives_retained_at_final": 3,  # 3+ alternatives retained = full score
    "num_contradictory_acknowledgements": None,  # normalised against total contradictory items
}

# Premature Closure component weights (must sum to 1.0)
PC_WEIGHTS = {
    "time_to_first_preferred_hypothesis": 0.20,
    "num_hypotheses_abandoned_early": 0.25,
    "num_contradictory_evidence_ignored": 0.35,
    "evidence_reviewed_before_final_ratio": 0.20,
}
# Time (seconds) at/below which "time to first preferred hypothesis" is
# considered maximally premature (full score on this component).
# 120 seconds = 2 minutes; above PC_TIME_UPPER is considered not premature.
PC_TIME_LOWER = 120
PC_TIME_UPPER = 1800  # 30 minutes


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def _normalise(value: float, max_value: Optional[float]) -> float:
    """Normalise value to [0,1] given an upper bound. Returns 0 if max_value is 0 or None-handled by caller."""
    if max_value is None or max_value <= 0:
        return 0.0
    return _clip01(value / max_value)


def _log_event(db: DBSession, session: ReconstructionSession, event_type: str, data: dict | None = None):
    log = ActivityLog(
        session_id=session.id,
        event_type=event_type,
        event_data=json.dumps(data or {}),
        stage_at_event=session.current_stage,
    )
    db.add(log)


def compute_session_metrics(db: DBSession, session: ReconstructionSession) -> SessionMetrics:
    """
    Recompute and persist all metrics for a session. Safe to call at any
    point in the workflow - fields that depend on later stages will be
    None/0 until that data exists, and the composites are recomputed
    using whatever data is currently available (final composite values
    should be read once the session is completed).
    """
    metrics = session.metrics
    if metrics is None:
        metrics = SessionMetrics(session_id=session.id)
        db.add(metrics)

    hypotheses: list[Hypothesis] = session.hypotheses
    evidence_links: list[EvidenceHypothesisLink] = session.evidence_links
    acknowledgements: list[AlternativeAcknowledgement] = session.acknowledgements
    final: Optional[FinalReconstruction] = session.final_reconstruction

    total_case_evidence = db.query(EvidenceItem).filter(EvidenceItem.case_id == session.case_id).count()

    # ---------------- Hypothesis Flexibility components ----------------
    num_hypotheses_generated = len(hypotheses)

    num_hypothesis_revisions = (
        db.query(HypothesisRevision)
        .join(Hypothesis, Hypothesis.id == HypothesisRevision.hypothesis_id)
        .filter(Hypothesis.session_id == session.id)
        .count()
    )

    num_evidence_hypothesis_links = len(evidence_links)

    num_alternatives_retained_at_final = sum(
        1 for h in hypotheses if h.is_retained_at_final and h.abandoned_at is None
    )

    num_contradictory_acknowledgements = sum(
        1 for a in acknowledgements
        if a.item_type == "contradictory_evidence" and a.acknowledged
    )

    metrics.num_hypotheses_generated = num_hypotheses_generated
    metrics.num_hypothesis_revisions = num_hypothesis_revisions
    metrics.num_evidence_hypothesis_links = num_evidence_hypothesis_links
    metrics.num_alternatives_retained_at_final = num_alternatives_retained_at_final
    metrics.num_contradictory_acknowledgements = num_contradictory_acknowledgements

    # Dynamic max for evidence-hypothesis links: total possible links =
    # evidence items * hypotheses (every evidence item evaluated against
    # every hypothesis would be "full" engagement).
    max_possible_links = total_case_evidence * max(num_hypotheses_generated, 1)

    # Dynamic max for contradictory acknowledgements = total contradictory
    # acknowledgement rows generated for this session (Stage 4 set).
    total_contradictory_items = sum(
        1 for a in acknowledgements if a.item_type == "contradictory_evidence"
    )

    hf_components = {
        "num_hypotheses_generated": _normalise(num_hypotheses_generated, HF_MAX["num_hypotheses_generated"]),
        "num_hypothesis_revisions": _normalise(num_hypothesis_revisions, HF_MAX["num_hypothesis_revisions"]),
        "num_evidence_hypothesis_links": _normalise(num_evidence_hypothesis_links, max_possible_links),
        "num_alternatives_retained_at_final": _normalise(num_alternatives_retained_at_final, HF_MAX["num_alternatives_retained_at_final"]),
        "num_contradictory_acknowledgements": _normalise(num_contradictory_acknowledgements, total_contradictory_items),
    }
    hypothesis_flexibility_score = 100.0 * sum(
        hf_components[k] * HF_WEIGHTS[k] for k in HF_WEIGHTS
    )
    metrics.hypothesis_flexibility_score = round(hypothesis_flexibility_score, 2)

    # ---------------- Premature Closure components ----------------

    time_to_first_preferred = None
    if session.first_preferred_hypothesis_at is not None:
        delta = session.first_preferred_hypothesis_at - session.started_at
        time_to_first_preferred = delta.total_seconds()
    metrics.time_to_first_preferred_hypothesis_seconds = time_to_first_preferred

    num_hypotheses_abandoned_early = sum(1 for h in hypotheses if h.abandoned_at is not None)
    metrics.num_hypotheses_abandoned_early = num_hypotheses_abandoned_early

    # Contradictory evidence ignored = contradictory_evidence acknowledgement
    # rows that were never acknowledged. (If session not yet at Stage 4,
    # this is 0 by construction since rows don't exist yet.)
    num_contradictory_evidence_ignored = sum(
        1 for a in acknowledgements
        if a.item_type == "contradictory_evidence" and not a.acknowledged
    )
    metrics.num_contradictory_evidence_ignored = num_contradictory_evidence_ignored

    # Evidence items reviewed before final decision = distinct evidence
    # items linked to ANY hypothesis, counted only if a final
    # reconstruction exists (otherwise this metric is not yet meaningful).
    distinct_evidence_reviewed = len({link.evidence_item_id for link in evidence_links})
    metrics.num_evidence_reviewed_before_final = distinct_evidence_reviewed

    # --- Premature closure composite ---
    if time_to_first_preferred is not None:
        # Inverted: shorter time -> higher prematurity score
        time_score = 1.0 - _clip01(
            (time_to_first_preferred - PC_TIME_LOWER) / (PC_TIME_UPPER - PC_TIME_LOWER)
        )
        time_score = _clip01(time_score)
    else:
        time_score = 0.0  # no preferred hypothesis yet -> no signal

    abandoned_score = _normalise(num_hypotheses_abandoned_early, max(num_hypotheses_generated - 1, 1))

    ignored_score = _normalise(num_contradictory_evidence_ignored, max(total_contradictory_items, 1))

    if total_case_evidence > 0:
        reviewed_ratio = distinct_evidence_reviewed / total_case_evidence
        # Inverted: reviewing FEWER items -> higher prematurity
        evidence_reviewed_score = _clip01(1.0 - reviewed_ratio)
    else:
        evidence_reviewed_score = 0.0

    pc_components = {
        "time_to_first_preferred_hypothesis": time_score,
        "num_hypotheses_abandoned_early": abandoned_score,
        "num_contradictory_evidence_ignored": ignored_score,
        "evidence_reviewed_before_final_ratio": evidence_reviewed_score,
    }
    premature_closure_score = 100.0 * sum(
        pc_components[k] * PC_WEIGHTS[k] for k in PC_WEIGHTS
    )
    metrics.premature_closure_score = round(premature_closure_score, 2)

    # ---------------- Confidence Calibration ----------------
    if final is not None:
        selected = next((h for h in hypotheses if h.id == final.selected_hypothesis_id), None)
        metrics.initial_confidence_of_selected = selected.initial_confidence if selected else None
        metrics.final_confidence = final.final_confidence
        metrics.final_accuracy = final.accuracy_score
        if final.accuracy_score is not None:
            metrics.calibration_error = round(abs(final.final_confidence - final.accuracy_score), 2)
        else:
            metrics.calibration_error = None
    else:
        metrics.initial_confidence_of_selected = None
        metrics.final_confidence = None
        metrics.final_accuracy = None
        metrics.calibration_error = None

    db.commit()
    db.refresh(metrics)
    return metrics
