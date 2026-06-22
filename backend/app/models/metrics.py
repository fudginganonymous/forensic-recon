"""
SessionMetrics model.

Stores the computed composite scores for a session, recalculated
whenever relevant (on stage transitions and on completion) by
app/services/metrics.py. Storing computed values (rather than only
calculating on-the-fly) makes researcher dashboard queries and CSV/Excel
exports fast and gives a stable snapshot for statistical analysis.

All raw component counts are also stored alongside the composite
scores so researchers can inspect/replicate the scoring formula or
build alternative composites in SPSS/R.
"""
from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class SessionMetrics(Base):
    __tablename__ = "session_metrics"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("reconstruction_sessions.id"), nullable=False, unique=True)

    # --- Hypothesis Flexibility components ---
    num_hypotheses_generated = Column(Integer, default=0)
    num_hypothesis_revisions = Column(Integer, default=0)
    num_evidence_hypothesis_links = Column(Integer, default=0)
    num_alternatives_retained_at_final = Column(Integer, default=0)
    num_contradictory_acknowledgements = Column(Integer, default=0)

    # Composite (0-100 normalised), see metrics.py for formula
    hypothesis_flexibility_score = Column(Float, nullable=True)

    # --- Premature Closure components ---
    time_to_first_preferred_hypothesis_seconds = Column(Float, nullable=True)
    num_hypotheses_abandoned_early = Column(Integer, default=0)
    num_contradictory_evidence_ignored = Column(Integer, default=0)
    num_evidence_reviewed_before_final = Column(Integer, default=0)

    # Composite (0-100 normalised, higher = more premature closure)
    premature_closure_score = Column(Float, nullable=True)

    # --- Confidence Calibration ---
    # Initial confidence of the hypothesis ultimately selected as final
    initial_confidence_of_selected = Column(Float, nullable=True)
    final_confidence = Column(Float, nullable=True)
    final_accuracy = Column(Float, nullable=True)
    # Calibration error = |final_confidence - final_accuracy| (lower = better calibrated)
    calibration_error = Column(Float, nullable=True)

    computed_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    session = relationship("ReconstructionSession", back_populates="metrics")
