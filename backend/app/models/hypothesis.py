"""
Hypothesis model - Stage 2, plus revision history.

Each hypothesis has a title, description and confidence score.
`HypothesisRevision` records every change to confidence/description
over time, which feeds directly into the "number of hypothesis
revisions" component of the Hypothesis Flexibility composite score,
and into confidence calibration (initial vs final confidence).

`is_retained_at_final` is set during Stage 5 to indicate whether this
hypothesis was still considered viable (not abandoned) by the end of
the exercise - used for "alternative hypotheses retained until final
stage".

`abandoned_at` is set when a participant explicitly marks a hypothesis
as no longer under consideration (optional UI action during Stages 3-4),
feeding "number of hypotheses abandoned early".
"""
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Hypothesis(Base):
    __tablename__ = "hypotheses"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("reconstruction_sessions.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)

    initial_confidence = Column(Float, nullable=False)  # 0-100 scale
    current_confidence = Column(Float, nullable=False)   # updated as revisions occur

    # Set true if participant explicitly abandons this hypothesis
    # before the final stage.
    abandoned_at = Column(DateTime(timezone=True), nullable=True)

    # Set during Stage 5 based on final hypothesis selection +
    # whether this hypothesis remained un-abandoned.
    is_retained_at_final = Column(Boolean, default=True)

    # Optional: for Bayesian module - prior probability (0-1).
    # Null if Bayesian module not used for this hypothesis.
    bayesian_prior = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ReconstructionSession", back_populates="hypotheses")
    revisions = relationship("HypothesisRevision", back_populates="hypothesis", cascade="all, delete-orphan")
    evidence_links = relationship("EvidenceHypothesisLink", back_populates="hypothesis", cascade="all, delete-orphan")
    bayesian_updates = relationship("BayesianUpdate", back_populates="hypothesis", cascade="all, delete-orphan")


class HypothesisRevision(Base):
    """
    Append-only log of changes to a hypothesis's confidence or
    description. Created automatically whenever a PATCH is made to a
    hypothesis after its initial creation.
    """
    __tablename__ = "hypothesis_revisions"

    id = Column(Integer, primary_key=True, index=True)
    hypothesis_id = Column(Integer, ForeignKey("hypotheses.id"), nullable=False)

    previous_confidence = Column(Float, nullable=False)
    new_confidence = Column(Float, nullable=False)

    # Optional free-text note on why the revision was made (participant
    # may be prompted to justify confidence changes - supports
    # "transparent decision making" requirement).
    rationale = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hypothesis = relationship("Hypothesis", back_populates="revisions")
