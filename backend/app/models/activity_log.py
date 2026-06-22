"""
ActivityLog model.

Generic append-only event log capturing every significant participant
action with a timestamp. This underpins most time-based metrics
("time to first preferred hypothesis", "evidence items reviewed before
final decision", stage transition times) and provides raw data for
exploratory analysis in SPSS/R beyond the pre-defined composite scores.

`event_type` is a free-form string but should use a controlled
vocabulary maintained in app/services/event_types.py for consistency.
`event_data` stores a JSON-serialised string with event-specific
details (e.g. {"hypothesis_id": 3, "old_confidence": 40, "new_confidence": 65}).
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("reconstruction_sessions.id"), nullable=False)

    event_type = Column(String, nullable=False, index=True)
    event_data = Column(Text, nullable=True)  # JSON string

    stage_at_event = Column(Integer, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    session = relationship("ReconstructionSession", back_populates="event_logs")
