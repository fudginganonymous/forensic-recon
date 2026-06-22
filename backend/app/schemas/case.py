"""
Pydantic schemas for Cases and Evidence Items.
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class EvidenceItemCreate(BaseModel):
    label: str
    description: str
    is_contradictory_by_design: bool = False


class EvidenceItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    label: str
    description: str
    file_path: Optional[str] = None
    is_contradictory_by_design: bool
    created_at: datetime


class EvidenceItemParticipantOut(BaseModel):
    """
    Version of EvidenceItem shown to participants - deliberately omits
    `is_contradictory_by_design` so as not to leak ground truth.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    case_id: int
    label: str
    description: str
    file_path: Optional[str] = None
    created_at: datetime


class CaseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    bayesian_enabled: bool = False
    ground_truth_summary: Optional[str] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    bayesian_enabled: Optional[bool] = None
    ground_truth_summary: Optional[str] = None
    is_active: Optional[bool] = None


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    bayesian_enabled: bool
    created_by: int
    created_at: datetime
    is_active: bool


class CaseDetailOut(CaseOut):
    evidence_items: List[EvidenceItemOut] = []


class CaseParticipantOut(BaseModel):
    """Case view for participants - omits ground_truth_summary."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    bayesian_enabled: bool
    evidence_items: List[EvidenceItemParticipantOut] = []
