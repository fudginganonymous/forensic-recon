"""
Observation model - Stage 1.

Captures pure observations only (no interpretation). Fields match the
specification exactly: Observation text, Source, Timestamp (of the
observed event/item, as reported by the participant - distinct from
created_at which is the record creation time used for behavioural
timing analysis).
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Observation(Base):
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("reconstruction_sessions.id"), nullable=False)

    observation_text = Column(Text, nullable=False)
    source = Column(String, nullable=False)

    # Participant-reported timestamp for the observed item/event
    observed_timestamp = Column(DateTime(timezone=True), nullable=True)

    # System-recorded creation time (for behavioural/timing metrics)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ReconstructionSession", back_populates="observations")
