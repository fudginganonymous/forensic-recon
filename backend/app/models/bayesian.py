"""
Bayesian module models.

Fully independent of the core workflow. A BayesianUpdate row records
one posterior calculation for a hypothesis at a point in time, given
the current set of evidence likelihood ratios. The "reasoning trail"
required by the spec is simply the ordered list of BayesianUpdate rows
for a hypothesis (each one shows prior -> posterior given the evidence
considered up to that point).

Posterior is computed using odds-form Bayesian updating:
  posterior_odds = prior_odds * product(likelihood_ratios)
  posterior_prob = posterior_odds / (1 + posterior_odds)

This module is only invoked when Case.bayesian_enabled is True and the
participant chooses to use it - it never blocks workflow progression.
"""
from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class BayesianUpdate(Base):
    __tablename__ = "bayesian_updates"

    id = Column(Integer, primary_key=True, index=True)
    hypothesis_id = Column(Integer, ForeignKey("hypotheses.id"), nullable=False)

    prior_probability = Column(Float, nullable=False)
    posterior_probability = Column(Float, nullable=False)

    # JSON list of {evidence_item_id, label, likelihood_ratio} used in
    # this calculation - the "reasoning trail" entry.
    evidence_considered = Column(Text, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hypothesis = relationship("Hypothesis", back_populates="bayesian_updates")
