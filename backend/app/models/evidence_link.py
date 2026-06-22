"""
EvidenceHypothesisLink model - Stage 3.

Represents a participant's evaluation of one evidence item against one
hypothesis, using the required 5-point scale:
  supports / weakly_supports / neutral / weakly_contradicts / contradicts

A "review" in Stage 3 means a participant has created at least one link
for an evidence item across the hypotheses under consideration. The API
layer enforces "Require all evidence items to be reviewed" by checking
that every EvidenceItem for the case has >=1 link from this session.

The numeric `stance_value` is a derived convenience field
(-2 to +2) used for fast aggregation in metric calculations.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

# Mapping of categorical stance to numeric value for aggregation
STANCE_VALUES = {
    "contradicts": -2,
    "weakly_contradicts": -1,
    "neutral": 0,
    "weakly_supports": 1,
    "supports": 2,
}


class EvidenceHypothesisLink(Base):
    __tablename__ = "evidence_hypothesis_links"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("reconstruction_sessions.id"), nullable=False)
    evidence_item_id = Column(Integer, ForeignKey("evidence_items.id"), nullable=False)
    hypothesis_id = Column(Integer, ForeignKey("hypotheses.id"), nullable=False)

    # One of: supports, weakly_supports, neutral, weakly_contradicts, contradicts
    stance = Column(String, nullable=False)
    stance_value = Column(Float, nullable=False)

    # Optional Bayesian likelihood ratio assigned by participant
    # (only used if Bayesian module enabled for this case).
    likelihood_ratio = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    session = relationship("ReconstructionSession", back_populates="evidence_links")
    hypothesis = relationship("Hypothesis", back_populates="evidence_links")
    evidence_item = relationship("EvidenceItem")
