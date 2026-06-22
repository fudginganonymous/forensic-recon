"""
Bayesian module router.

Fully independent of the core workflow routes. All endpoints require
that the session's `bayesian_enabled_snapshot` is True (i.e. the
researcher enabled the module for the case at the time the session was
started). Calling these endpoints is entirely optional and never
affects `current_stage` or any core workflow data.
"""
import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.db.session import get_db
from app.core.deps import get_current_user, require_participant
from app.models.user import User
from app.models.session import ReconstructionSession
from app.models.hypothesis import Hypothesis
from app.models.bayesian import BayesianUpdate
from app.schemas.metrics import (
    BayesianUpdateRequest, BayesianUpdateOut, BayesianHypothesisSummary, EvidenceConsideredEntry,
)
from app.services.bayesian import compute_posterior
from app.services import event_types as ET
from app.services.metrics import _log_event

router = APIRouter(prefix="/bayesian", tags=["Bayesian Module (Optional)"])


def _get_session_with_bayesian_check(session_id: int, user: User, db: DBSession) -> ReconstructionSession:
    session = db.query(ReconstructionSession).filter(ReconstructionSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if user.role == "participant" and session.participant_id != user.id:
        raise HTTPException(status_code=403, detail="Not your session")
    if not session.bayesian_enabled_snapshot:
        raise HTTPException(status_code=400, detail="The Bayesian module is not enabled for this session's case.")
    return session


def _parse_update(update: BayesianUpdate) -> BayesianUpdateOut:
    evidence_considered = [EvidenceConsideredEntry(**e) for e in json.loads(update.evidence_considered)]
    return BayesianUpdateOut(
        id=update.id,
        hypothesis_id=update.hypothesis_id,
        prior_probability=update.prior_probability,
        posterior_probability=update.posterior_probability,
        evidence_considered=evidence_considered,
        created_at=update.created_at,
    )


@router.post("/hypotheses/{hypothesis_id}/update", response_model=BayesianUpdateOut, status_code=201)
def compute_bayesian_update(hypothesis_id: int, body: BayesianUpdateRequest, participant: User = Depends(require_participant), db: DBSession = Depends(get_db)):
    """
    Compute a new posterior probability for the given hypothesis based
    on its currently recorded evidence likelihood ratios (Stage 3 data),
    optionally overriding the prior. Appends to the hypothesis's
    Bayesian reasoning trail.
    """
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found")

    session = _get_session_with_bayesian_check(hypothesis.session_id, participant, db)

    update = compute_posterior(db, hypothesis, prior_override=body.prior_override)

    _log_event(db, session, ET.BAYESIAN_UPDATE_COMPUTED, {
        "hypothesis_id": hypothesis.id,
        "posterior": update.posterior_probability,
    })
    db.commit()

    return _parse_update(update)


@router.get("/hypotheses/{hypothesis_id}/trail", response_model=List[BayesianUpdateOut])
def get_bayesian_trail(hypothesis_id: int, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    """Returns the full ordered Bayesian reasoning trail for a hypothesis."""
    hypothesis = db.query(Hypothesis).filter(Hypothesis.id == hypothesis_id).first()
    if not hypothesis:
        raise HTTPException(status_code=404, detail="Hypothesis not found")

    _get_session_with_bayesian_check(hypothesis.session_id, current_user, db)

    updates = (
        db.query(BayesianUpdate)
        .filter(BayesianUpdate.hypothesis_id == hypothesis_id)
        .order_by(BayesianUpdate.created_at.asc())
        .all()
    )
    return [_parse_update(u) for u in updates]


@router.get("/sessions/{session_id}/summary", response_model=List[BayesianHypothesisSummary])
def get_session_bayesian_summary(session_id: int, current_user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    """
    Convenience endpoint returning, for every hypothesis in the session,
    its prior and full update trail - suitable for rendering probability
    graphs on the frontend.
    """
    session = _get_session_with_bayesian_check(session_id, current_user, db)

    summaries = []
    for hypothesis in session.hypotheses:
        updates = (
            db.query(BayesianUpdate)
            .filter(BayesianUpdate.hypothesis_id == hypothesis.id)
            .order_by(BayesianUpdate.created_at.asc())
            .all()
        )
        trail = [_parse_update(u) for u in updates]
        summaries.append(BayesianHypothesisSummary(
            hypothesis_id=hypothesis.id,
            hypothesis_title=hypothesis.title,
            prior=hypothesis.bayesian_prior,
            latest_posterior=trail[-1].posterior_probability if trail else None,
            trail=trail,
        ))

    return summaries
