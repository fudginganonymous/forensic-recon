"""
AlternativeAcknowledgement model - Stage 4.

Stage 4 automatically presents the participant with:
  - hypotheses not currently favoured (i.e. not the highest-confidence one)
  - contradictory evidence (evidence with stance in
    {contradicts, weakly_contradicts} for the favoured hypothesis)
  - unassigned evidence (evidence items with no link to the favoured
    hypothesis at all)

Each item the participant must acknowledge generates one row here.
`item_type` distinguishes the three categories. `acknowledged` must be
true for the session to progress to Stage 5.

The count and content of these rows is also used directly for the
"number of contradictory evidence acknowledgements" and "ignored
contradictory evidence" metrics (an unacknowledged contradictory item
counts as "ignored").
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class AlternativeAcknowledgement(Base):
    __tablename__ = "alternative_acknowledgements"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("reconstruction_sessions.id"), nullable=False)

    # 'alternative_hypothesis' | 'contradictory_evidence' | 'unassigned_evidence'
    item_type = Column(String, nullable=False)

    # Reference IDs - only one will be populated depending on item_type
    hypothesis_id = Column(Integer, ForeignKey("hypotheses.id"), nullable=True)
    evidence_item_id = Column(Integer, ForeignKey("evidence_items.id"), nullable=True)

    acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)

    # Optional free-text reflection prompt response
    reflection_note = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ReconstructionSession", back_populates="acknowledgements")
