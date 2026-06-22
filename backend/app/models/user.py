"""
User model.

Two roles are supported:
- 'participant': performs reconstruction exercises
- 'researcher': creates cases, uploads evidence, reviews metrics, toggles
  the Bayesian module

Role is stored as a plain string column (rather than a separate table)
to keep the schema simple for a research prototype; this can be
normalised later if needed.
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)

    # 'participant' or 'researcher'
    role = Column(String, nullable=False, default="participant")

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # A participant may have multiple session attempts (one per assigned case)
    sessions = relationship("ReconstructionSession", back_populates="participant")
