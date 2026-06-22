"""
Case and Evidence models.

A Case represents a mock crime scene scenario created by a researcher.
Evidence items are uploaded against a case and made available to
participants during Stage 3 (Evidence Evaluation).

`ground_truth_hypothesis_id` is optional and used later to compute
final reconstruction accuracy for calibration metrics. It is not shown
to participants.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    # Whether the Bayesian assistance module is available for this case.
    # Researcher-controlled toggle. Defaults to disabled so the
    # structured workflow is the primary condition under test.
    bayesian_enabled = Column(Boolean, default=False, nullable=False)

    # Ground truth hypothesis title (free text), used only for scoring
    # final reconstruction accuracy. Never exposed to participants via API.
    ground_truth_summary = Column(Text, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    evidence_items = relationship("EvidenceItem", back_populates="case", cascade="all, delete-orphan")
    sessions = relationship("ReconstructionSession", back_populates="case")


class EvidenceItem(Base):
    __tablename__ = "evidence_items"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    label = Column(String, nullable=False)          # short identifier, e.g. "Item 4: Blood spatter"
    description = Column(Text, nullable=False)

    # Optional uploaded file (photo, document) path relative to UPLOAD_DIR
    file_path = Column(String, nullable=True)

    # Researcher-tagged ground truth: does this evidence genuinely
    # contradict the "favoured" / decoy hypothesis? Used to compute
    # "ignored contradictory evidence" metric objectively.
    is_contradictory_by_design = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case", back_populates="evidence_items")
