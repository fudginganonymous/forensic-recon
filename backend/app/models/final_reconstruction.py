"""
FinalReconstruction model - Stage 5.

Captures the participant's final output: selected hypothesis, narrative,
and final confidence rating. `accuracy_score` is computed by researchers
(or an automated text-similarity routine, left as a manual/admin field
for the prototype) by comparing the narrative/selected hypothesis to the
case's ground_truth_summary, and feeds the calibration metric
(final confidence vs final accuracy).
"""
from sqlalchemy import Column, Integer, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class FinalReconstruction(Base):
    __tablename__ = "final_reconstructions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("reconstruction_sessions.id"), nullable=False, unique=True)

    selected_hypothesis_id = Column(Integer, ForeignKey("hypotheses.id"), nullable=False)
    final_narrative = Column(Text, nullable=False)
    final_confidence = Column(Float, nullable=False)  # 0-100 scale

    # Manually scored by researcher (0-100), nullable until scored.
    accuracy_score = Column(Float, nullable=True)
    scored_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    scored_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ReconstructionSession", back_populates="final_reconstruction")
    selected_hypothesis = relationship("Hypothesis")
