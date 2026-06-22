"""
Sessions router.

Implements the full 5-stage reconstruction workflow:
  1. Observation
  2. Hypothesis Generation
  3. Evidence Evaluation
  4. Alternative Hypothesis Review
  5. Final Reconstruction

Stage-progression rules are enforced server-side via `_advance_stage`
checks on each "complete stage" endpoint, in addition to whatever the
frontend UI prevents - this ensures data integrity for research metrics
even if the API is called directly.

All mutating actions are logged to ActivityLog via
app.services.metrics._log_event for behavioural analysis, and
SessionMetrics are recomputed after each stage transition.
"""
import json
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.db.session import get_db
from app.core.deps import get_current_user, require_participant
from app.models.user import User
from app.models.case import Case, EvidenceItem
from app.models.session import ReconstructionSession
from app.models.observation import Observation
from app.models.hypothesis import Hypothesis, HypothesisRevision
from app.models.evidence_link import EvidenceHypothesisLink, STANCE_VALUES
from app.models.acknowledgement import AlternativeAcknowledgement
from app.models.final_reconstruction import FinalReconstruction
from app.schemas.session import (
    SessionCreate, SessionOut, SessionDetailOut,
    ObservationCreate, ObservationOut,
    HypothesisCreate, HypothesisUpdate, HypothesisAbandon, HypothesisOut, HypothesisRevisionOut,
    EvidenceLinkCreate, EvidenceLinkOut, EvidenceReviewStatus,
    AlternativeReviewItemOut, AcknowledgeRequest,
    FinalReconstructionCreate, FinalReconstructionOut, AccuracyScoreUpdate,
)
from app.services import event_types as ET
from app.services.metrics import compute_session_metrics, _log_event

router = APIRouter(prefix="/sessions", tags=["Reconstruction Sessions"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_owned_session(session_id: int, user: User, db: DBSession) -> ReconstructionSession:
    """Fetch a session and ensure it belongs to the requesting participant
    (or the user is a researcher, who may view any session read-only via
    the researcher dashboard router)."""
    session = db.query(ReconstructionSession).filter(ReconstructionSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if user.role == "participant" and session.participant_id != user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    return session


def _require_stage(session: ReconstructionSession, minimum_stage: int):
    if session.current_stage < minimum_stage:
        raise HTTPException(
            status_code=400,
            detail=f"This action requires the session to be at stage {minimum_stage} "
                   f"(currently at stage {session.current_stage}).",
        )


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------

@router.post("", response_model=SessionOut, status_code=201)
def start_session(session_in: SessionCreate, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """Start a new reconstruction session for a case. A participant may
    start multiple sessions (e.g. across different cases), but only one
    active (incomplete) session per case is recommended - the frontend
    should check `/sessions/mine` first."""
    case = db.query(Case).filter(Case.id == session_in.case_id, Case.is_active == True).first()  # noqa: E712
    if not case:
        raise HTTPException(status_code=404, detail="Case not found or inactive")

    session = ReconstructionSession(
        participant_id=participant.id,
        case_id=case.id,
        current_stage=1,
        bayesian_enabled_snapshot=case.bayesian_enabled,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    _log_event(db, session, ET.SESSION_STARTED, {"case_id": case.id})
    db.commit()
    return session


@router.get("/mine", response_model=List[SessionOut])
def my_sessions(participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    return (
        db.query(ReconstructionSession)
        .filter(ReconstructionSession.participant_id == participant.id)
        .order_by(ReconstructionSession.started_at.desc())
        .all()
    )


@router.get("/{session_id}", response_model=SessionDetailOut)
def get_session_detail(session_id: int, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    return _get_owned_session(session_id, current_user, db)


# ---------------------------------------------------------------------------
# Stage 1: Observation
# ---------------------------------------------------------------------------

@router.post("/{session_id}/observations", response_model=ObservationOut, status_code=201)
def add_observation(session_id: int, obs_in: ObservationCreate, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    session = _get_owned_session(session_id, participant, db)

    observation = Observation(
        session_id=session.id,
        observation_text=obs_in.observation_text,
        source=obs_in.source,
        observed_timestamp=obs_in.observed_timestamp,
    )
    db.add(observation)
    db.commit()
    db.refresh(observation)

    _log_event(db, session, ET.OBSERVATION_CREATED, {"observation_id": observation.id})
    db.commit()
    return observation


@router.get("/{session_id}/observations", response_model=List[ObservationOut])
def list_observations(session_id: int, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    session = _get_owned_session(session_id, current_user, db)
    return session.observations


@router.post("/{session_id}/advance-to-stage-2", response_model=SessionOut)
def advance_to_stage_2(session_id: int, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """
    Complete Stage 1. Requires at least one observation recorded.
    (The spec says "store all entries" without a strict minimum count,
    but at least one observation is required to ensure participants
    engage with the stage before proceeding.)
    """
    session = _get_owned_session(session_id, participant, db)
    _require_stage(session, 1)

    if len(session.observations) < 1:
        raise HTTPException(status_code=400, detail="At least one observation is required before proceeding.")

    if session.current_stage == 1:
        session.current_stage = 2
        _log_event(db, session, ET.STAGE_ADVANCED, {"to_stage": 2})
        db.commit()
        db.refresh(session)
    return session


# ---------------------------------------------------------------------------
# Stage 2: Hypothesis Generation
# ---------------------------------------------------------------------------

@router.post("/{session_id}/hypotheses", response_model=HypothesisOut, status_code=201)
def add_hypothesis(session_id: int, hyp_in: HypothesisCreate, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    session = _get_owned_session(session_id, participant, db)
    _require_stage(session, 2)

    hypothesis = Hypothesis(
        session_id=session.id,
        title=hyp_in.title,
        description=hyp_in.description,
        initial_confidence=hyp_in.initial_confidence,
        current_confidence=hyp_in.initial_confidence,
        bayesian_prior=hyp_in.bayesian_prior,
    )
    db.add(hypothesis)
    db.commit()
    db.refresh(hypothesis)

    _log_event(db, session, ET.HYPOTHESIS_CREATED, {
        "hypothesis_id": hypothesis.id,
        "initial_confidence": hyp_in.initial_confidence,
    })
    db.commit()

    _maybe_update_first_preferred(db, session)
    return hypothesis


@router.get("/{session_id}/hypotheses", response_model=List[HypothesisOut])
def list_hypotheses(session_id: int, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    session = _get_owned_session(session_id, current_user, db)
    return session.hypotheses


@router.patch("/{session_id}/hypotheses/{hypothesis_id}", response_model=HypothesisOut)
def revise_hypothesis(session_id: int, hypothesis_id: int, update_in: HypothesisUpdate, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """
    Revise a hypothesis's confidence and/or description. Every change to
    `current_confidence` creates a HypothesisRevision row, which feeds
    the "number of hypothesis revisions" flexibility component and the
    confidence calibration analysis.
    """
    session = _get_owned_session(session_id, participant, db)
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id, Hypothesis.session_id == session.id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found")

    if update_in.current_confidence is not None and update_in.current_confidence != hypothesis.current_confidence:
        revision = HypothesisRevision(
            hypothesis_id=hypothesis.id,
            previous_confidence=hypothesis.current_confidence,
            new_confidence=update_in.current_confidence,
            rationale=update_in.rationale,
        )
        db.add(revision)
        hypothesis.current_confidence = update_in.current_confidence

        _log_event(db, session, ET.HYPOTHESIS_REVISED, {
            "hypothesis_id": hypothesis.id,
            "previous_confidence": revision.previous_confidence,
            "new_confidence": revision.new_confidence,
        })

    if update_in.description is not None:
        hypothesis.description = update_in.description

    db.commit()
    db.refresh(hypothesis)

    _maybe_update_first_preferred(db, session)
    return hypothesis


@router.post("/{session_id}/hypotheses/{hypothesis_id}/abandon", response_model=HypothesisOut)
def abandon_hypothesis(session_id: int, hypothesis_id: int, body: HypothesisAbandon, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """
    Explicitly mark a hypothesis as abandoned (no longer under
    consideration). Feeds "number of hypotheses abandoned early" if done
    before Stage 5, and sets is_retained_at_final = False.
    """
    session = _get_owned_session(session_id, participant, db)
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id, Hypothesis.session_id == session.id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found")

    if body.abandon:
        hypothesis.abandoned_at = datetime.now(timezone.utc)
        hypothesis.is_retained_at_final = False
        _log_event(db, session, ET.HYPOTHESIS_ABANDONED, {"hypothesis_id": hypothesis.id})
    else:
        hypothesis.abandoned_at = None
        hypothesis.is_retained_at_final = True

    db.commit()
    db.refresh(hypothesis)
    return hypothesis


@router.get("/{session_id}/hypotheses/{hypothesis_id}/revisions", response_model=List[HypothesisRevisionOut])
def list_hypothesis_revisions(session_id: int, hypothesis_id: int, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    session = _get_owned_session(session_id, current_user, db)
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id, Hypothesis.session_id == session.id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found")
    return hypothesis.revisions


def _maybe_update_first_preferred(db: DBSession, session: ReconstructionSession):
    """
    Detect the "currently favoured" hypothesis (highest current_confidence
    among non-abandoned hypotheses) and, the first time one exists, record
    `first_preferred_hypothesis_at` for the "time to first preferred
    hypothesis" premature closure metric. This timestamp is set ONCE and
    never overwritten, even if the favoured hypothesis later changes.
    """
    if session.first_preferred_hypothesis_at is not None:
        return

    active_hypotheses = [h for h in session.hypotheses if h.abandoned_at is None]
    if not active_hypotheses:
        return

    # Only meaningful once there are at least 2 hypotheses (the minimum
    # required by Stage 2) and one has a strictly higher confidence than
    # the rest.
    if len(session.hypotheses) < 2:
        return

    sorted_h = sorted(active_hypotheses, key=lambda h: h.current_confidence, reverse=True)
    if len(sorted_h) >= 2 and sorted_h[0].current_confidence > sorted_h[1].current_confidence:
        session.first_preferred_hypothesis_at = datetime.now(timezone.utc)
        _log_event(db, session, ET.HYPOTHESIS_BECAME_PREFERRED, {"hypothesis_id": sorted_h[0].id})
        db.commit()


@router.post("/{session_id}/advance-to-stage-3", response_model=SessionOut)
def advance_to_stage_3(session_id: int, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """Complete Stage 2. Requires at least two (non-abandoned) hypotheses."""
    session = _get_owned_session(session_id, participant, db)
    _require_stage(session, 2)

    active = [h for h in session.hypotheses if h.abandoned_at is None]
    if len(active) < 2:
        raise HTTPException(status_code=400, detail="At least two competing hypotheses are required before proceeding.")

    if session.current_stage == 2:
        session.current_stage = 3
        _log_event(db, session, ET.STAGE_ADVANCED, {"to_stage": 3})
        db.commit()
        db.refresh(session)
    return session


# ===========================================================================
# Stages 3-5 (continued)
# ===========================================================================


# ---------------------------------------------------------------------------
# Stage 3: Evidence Evaluation
# ---------------------------------------------------------------------------

@router.post("/{session_id}/evidence-links", response_model=EvidenceLinkOut, status_code=201)
def create_or_update_evidence_link(session_id: int, link_in: EvidenceLinkCreate, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """
    Record (or update) a participant's evaluation of one evidence item
    against one hypothesis. If a link for this
    (session, evidence_item, hypothesis) combination already exists, it
    is updated in place (an UPDATE counts towards
    `num_evidence_hypothesis_links` only once via distinct rows, but the
    update event itself is still logged for behavioural analysis).
    """
    session = _get_owned_session(session_id, participant, db)
    _require_stage(session, 3)

    evidence_item = db.query(EvidenceItem).filter(EvidenceItem.id == link_in.evidence_item_id, EvidenceItem.case_id == session.case_id).first()
    if not evidence_item:
        raise HTTPException(status_code=404, detail="Evidence item not found for this case")

    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == link_in.hypothesis_id, Hypothesis.session_id == session.id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found for this session")

    existing = (
        db.query(EvidenceHypothesisLink)
        .filter(
            EvidenceHypothesisLink.session_id == session.id,
            EvidenceHypothesisLink.evidence_item_id == link_in.evidence_item_id,
            EvidenceHypothesisLink.hypothesis_id == link_in.hypothesis_id,
        )
        .first()
    )

    stance_value = STANCE_VALUES[link_in.stance]

    if existing:
        existing.stance = link_in.stance
        existing.stance_value = stance_value
        existing.likelihood_ratio = link_in.likelihood_ratio
        link = existing
        event_type = ET.EVIDENCE_LINK_UPDATED
    else:
        link = EvidenceHypothesisLink(
            session_id=session.id,
            evidence_item_id=link_in.evidence_item_id,
            hypothesis_id=link_in.hypothesis_id,
            stance=link_in.stance,
            stance_value=stance_value,
            likelihood_ratio=link_in.likelihood_ratio,
        )
        db.add(link)
        event_type = ET.EVIDENCE_LINK_CREATED

    db.commit()
    db.refresh(link)

    _log_event(db, session, event_type, {
        "evidence_item_id": link.evidence_item_id,
        "hypothesis_id": link.hypothesis_id,
        "stance": link.stance,
    })
    db.commit()
    return link


@router.get("/{session_id}/evidence-links", response_model=List[EvidenceLinkOut])
def list_evidence_links(session_id: int, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    session = _get_owned_session(session_id, current_user, db)
    return session.evidence_links


@router.get("/{session_id}/evidence-review-status", response_model=EvidenceReviewStatus)
def evidence_review_status(session_id: int, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    """
    Returns which evidence items have at least one
    EvidenceHypothesisLink in this session, supporting the frontend's
    enforcement of "Require all evidence items to be reviewed" before
    Stage 4.
    """
    session = _get_owned_session(session_id, current_user, db)

    all_items = db.query(EvidenceItem).filter(EvidenceItem.case_id == session.case_id).all()
    reviewed_ids = {link.evidence_item_id for link in session.evidence_links}

    unreviewed = [item.id for item in all_items if item.id not in reviewed_ids]

    return EvidenceReviewStatus(
        total_evidence_items=len(all_items),
        reviewed_evidence_items=len(reviewed_ids),
        unreviewed_evidence_item_ids=unreviewed,
        all_reviewed=len(unreviewed) == 0,
    )


@router.post("/{session_id}/advance-to-stage-4", response_model=SessionOut)
def advance_to_stage_4(session_id: int, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """
    Complete Stage 3. Requires every evidence item in the case to have
    been reviewed (linked to at least one hypothesis), per the
    specification's "Require all evidence items to be reviewed".

    On advancing, this endpoint automatically generates the Stage 4
    AlternativeAcknowledgement rows: not-favoured hypotheses,
    contradictory evidence (for the favoured hypothesis), and
    unassigned evidence.
    """
    session = _get_owned_session(session_id, participant, db)
    _require_stage(session, 3)

    status_check = evidence_review_status(session_id, participant, db)
    if not status_check.all_reviewed:
        raise HTTPException(
            status_code=400,
            detail=f"All evidence items must be reviewed before proceeding. "
                   f"{len(status_check.unreviewed_evidence_item_ids)} item(s) remaining.",
        )

    if session.current_stage == 3:
        _generate_stage4_acknowledgement_items(db, session)
        session.current_stage = 4
        _log_event(db, session, ET.STAGE_ADVANCED, {"to_stage": 4})
        db.commit()
        db.refresh(session)

    return session


def _generate_stage4_acknowledgement_items(db: DBSession, session: ReconstructionSession):
    """
    Determine the "favoured" hypothesis (highest current_confidence among
    non-abandoned hypotheses) and generate AlternativeAcknowledgement rows for:
      - every other non-abandoned hypothesis ("alternative_hypothesis")
      - every evidence item linked to the favoured hypothesis with stance
        in {contradicts, weakly_contradicts} ("contradictory_evidence")
      - every evidence item with NO link to the favoured hypothesis
        ("unassigned_evidence")

    Idempotent: does nothing if rows already exist for this session
    (e.g. if advance-to-stage-4 is called more than once).
    """
    existing_count = db.query(AlternativeAcknowledgement).filter(AlternativeAcknowledgement.session_id == session.id).count()
    if existing_count > 0:
        return

    active_hypotheses = [h for h in session.hypotheses if h.abandoned_at is None]
    if not active_hypotheses:
        return

    favoured = max(active_hypotheses, key=lambda h: h.current_confidence)

    # 1. Alternative (not-favoured) hypotheses
    for h in active_hypotheses:
        if h.id != favoured.id:
            db.add(AlternativeAcknowledgement(
                session_id=session.id,
                item_type="alternative_hypothesis",
                hypothesis_id=h.id,
            ))

    # 2. Contradictory evidence for the favoured hypothesis
    favoured_links = {
        link.evidence_item_id: link
        for link in session.evidence_links
        if link.hypothesis_id == favoured.id
    }
    for evidence_item_id, link in favoured_links.items():
        if link.stance in ("contradicts", "weakly_contradicts"):
            db.add(AlternativeAcknowledgement(
                session_id=session.id,
                item_type="contradictory_evidence",
                evidence_item_id=evidence_item_id,
            ))

    # 3. Evidence items with no link at all to the favoured hypothesis
    all_evidence_ids = {item.id for item in db.query(EvidenceItem).filter(EvidenceItem.case_id == session.case_id).all()}
    unassigned_ids = all_evidence_ids - set(favoured_links.keys())
    for evidence_item_id in unassigned_ids:
        db.add(AlternativeAcknowledgement(
            session_id=session.id,
            item_type="unassigned_evidence",
            evidence_item_id=evidence_item_id,
        ))

    db.commit()


# ---------------------------------------------------------------------------
# Stage 4: Alternative Hypothesis Review
# ---------------------------------------------------------------------------

@router.get("/{session_id}/alternative-review", response_model=List[AlternativeReviewItemOut])
def list_alternative_review_items(session_id: int, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    session = _get_owned_session(session_id, current_user, db)
    return session.acknowledgements


@router.post("/{session_id}/alternative-review/{item_id}/acknowledge", response_model=AlternativeReviewItemOut)
def acknowledge_item(session_id: int, item_id: int, body: AcknowledgeRequest, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """
    Mark a Stage 4 review item as acknowledged. All items must be
    acknowledged before the session can advance to Stage 5.
    """
    session = _get_owned_session(session_id, participant, db)
    _require_stage(session, 4)

    item = db.query(AlternativeAcknowledgement).filter(
        AlternativeAcknowledgement.id == item_id,
        AlternativeAcknowledgement.session_id == session.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")

    item.acknowledged = True
    item.acknowledged_at = datetime.now(timezone.utc)
    if body.reflection_note is not None:
        item.reflection_note = body.reflection_note

    db.commit()
    db.refresh(item)

    _log_event(db, session, ET.ALTERNATIVE_ACKNOWLEDGED, {
        "item_id": item.id,
        "item_type": item.item_type,
    })
    db.commit()
    return item


@router.post("/{session_id}/advance-to-stage-5", response_model=SessionOut)
def advance_to_stage_5(session_id: int, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """Complete Stage 4. Requires every AlternativeAcknowledgement row to be acknowledged."""
    session = _get_owned_session(session_id, participant, db)
    _require_stage(session, 4)

    unacknowledged = [a for a in session.acknowledgements if not a.acknowledged]
    if unacknowledged:
        raise HTTPException(
            status_code=400,
            detail=f"{len(unacknowledged)} alternative review item(s) must be acknowledged before proceeding.",
        )

    if session.current_stage == 4:
        session.current_stage = 5
        _log_event(db, session, ET.STAGE_ADVANCED, {"to_stage": 5})
        db.commit()
        db.refresh(session)

    return session


# ---------------------------------------------------------------------------
# Stage 5: Final Reconstruction
# ---------------------------------------------------------------------------

@router.post("/{session_id}/final-reconstruction", response_model=FinalReconstructionOut, status_code=201)
def submit_final_reconstruction(session_id: int, final_in: FinalReconstructionCreate, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """
    Submit the final reconstruction. This is the terminal data-entry
    step of the workflow. After submission, the session is marked
    completed and final SessionMetrics are computed.
    """
    session = _get_owned_session(session_id, participant, db)
    _require_stage(session, 5)

    hypothesis = db.query(Hypothesis).filter(
        Hypothesis.id == final_in.selected_hypothesis_id,
        Hypothesis.session_id == session.id,
    ).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Selected hypothesis not found for this session")

    if session.final_reconstruction is not None:
        raise HTTPException(status_code=400, detail="Final reconstruction already submitted for this session")

    final = FinalReconstruction(
        session_id=session.id,
        selected_hypothesis_id=final_in.selected_hypothesis_id,
        final_narrative=final_in.final_narrative,
        final_confidence=final_in.final_confidence,
    )
    db.add(final)

    # Mark all non-abandoned hypotheses other than the selected one as
    # "retained at final" if they were never abandoned - i.e. they
    # remained viable alternatives even though not ultimately chosen.
    for h in session.hypotheses:
        if h.abandoned_at is None:
            h.is_retained_at_final = True
        else:
            h.is_retained_at_final = False

    session.current_stage = 6  # Completed
    session.completed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(final)

    _log_event(db, session, ET.FINAL_RECONSTRUCTION_SUBMITTED, {
        "selected_hypothesis_id": final_in.selected_hypothesis_id,
        "final_confidence": final_in.final_confidence,
    })
    _log_event(db, session, ET.SESSION_COMPLETED, {})
    db.commit()

    # Compute final metrics now that all data is available
    compute_session_metrics(db, session)

    return final


@router.patch("/{session_id}/final-reconstruction/accuracy", response_model=FinalReconstructionOut)
def score_accuracy(session_id: int, body: AccuracyScoreUpdate, researcher: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    """
    Researcher endpoint to manually score the accuracy (0-100) of a
    participant's final reconstruction against the case's ground truth.
    Triggers recomputation of confidence calibration metrics.
    """
    if researcher.role != "researcher":
        raise HTTPException(status_code=403, detail="Researcher privileges required")

    session = db.query(ReconstructionSession).filter(ReconstructionSession.id == session_id).first()
    if not session or not session.final_reconstruction:
        raise HTTPException(status_code=404, detail="Final reconstruction not found for this session")

    final = session.final_reconstruction
    final.accuracy_score = body.accuracy_score
    final.scored_by = researcher.id
    final.scored_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(final)

    compute_session_metrics(db, session)
    return final
