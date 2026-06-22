"""
ReconstructionSession model.

This is the central record for one participant's attempt at one case.
All workflow data (observations, hypotheses, evidence links, etc.) is
linked to a session. Timestamps on this model and its children are the
basis for time-based metrics (e.g. "time to first preferred hypothesis").

`current_stage` tracks workflow progression (1-5) and is enforced by
the API layer to prevent skipping stages, per the specification:
"Prevent progression until minimum hypotheses entered" etc.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class ReconstructionSession(Base):
    __tablename__ = "reconstruction_sessions"

    id = Column(Integer, primary_key=True, index=True)
    participant_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    # 1 = Observation, 2 = Hypothesis Generation, 3 = Evidence Evaluation,
    # 4 = Alternative Hypothesis Review, 5 = Final Reconstruction,
    # 6 = Completed
    current_stage = Column(Integer, default=1, nullable=False)

    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Timestamp at which the participant's first hypothesis was marked
    # as "currently favoured" (highest confidence). Used for
    # "time to first preferred hypothesis" metric. Set automatically.
    first_preferred_hypothesis_at = Column(DateTime(timezone=True), nullable=True)

    # Snapshot of whether Bayesian module was enabled for this session
    # (copied from Case at session start, so later toggling the case
    # setting does not retroactively change historical data).
    bayesian_enabled_snapshot = Column(Boolean, default=False)

    participant = relationship("User", back_populates="sessions")
    case = relationship("Case", back_populates="sessions")

    observations = relationship("Observation", back_populates="session", cascade="all, delete-orphan")
    hypotheses = relationship("Hypothesis", back_populates="session", cascade="all, delete-orphan")
    evidence_links = relationship("EvidenceHypothesisLink", back_populates="session", cascade="all, delete-orphan")
    acknowledgements = relationship("AlternativeAcknowledgement", back_populates="session", cascade="all, delete-orphan")
    final_reconstruction = relationship("FinalReconstruction", back_populates="session", uselist=False, cascade="all, delete-orphan")
    event_logs = relationship("ActivityLog", back_populates="session", cascade="all, delete-orphan")
    metrics = relationship("SessionMetrics", back_populates="session", uselist=False, cascade="all, delete-orphan")
