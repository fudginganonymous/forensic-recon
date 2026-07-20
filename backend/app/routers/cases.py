"""
Cases router.

Researcher endpoints: create/update cases, upload evidence items,
toggle Bayesian module per case.

Participant endpoints: list assigned/available cases, view case detail
(without ground truth fields).
"""
import os
import shutil
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.deps import get_current_user, require_researcher
from app.core.config import settings
from app.models.user import User
from app.models.case import Case, EvidenceItem
from app.schemas.case import (
    CaseCreate, CaseUpdate, CaseOut, CaseDetailOut, CaseParticipantOut,
    EvidenceItemCreate, EvidenceItemOut,
)

router = APIRouter(prefix="/cases", tags=["Cases"])


# ---------------- Researcher: case management ----------------

@router.post("", response_model=CaseOut, status_code=201)
def create_case(case_in: CaseCreate, researcher: User = Depends(require_researcher), db: Session = Depends(get_db)):
    case = Case(
        title=case_in.title,
        description=case_in.description,
        bayesian_enabled=case_in.bayesian_enabled,
        ground_truth_summary=case_in.ground_truth_summary,
        created_by=researcher.id,
    )
    db.add(case)
    db.commit()
    db.refresh(case)
    return case


@router.get("", response_model=List[CaseOut])
def list_cases_researcher(researcher: User = Depends(require_researcher), db: Session = Depends(get_db)):
    return db.query(Case).order_by(Case.created_at.desc()).all()


@router.get("/{case_id}", response_model=CaseDetailOut)
def get_case_researcher(case_id: int, researcher: User = Depends(require_researcher), db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.patch("/{case_id}", response_model=CaseOut)
def update_case(case_id: int, case_in: CaseUpdate, researcher: User = Depends(require_researcher), db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    update_data = case_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(case, field, value)

    db.commit()
    db.refresh(case)
    return case


@router.delete("/{case_id}", status_code=204)
def delete_case(case_id: int, researcher: User = Depends(require_researcher), db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    db.delete(case)
    db.commit()
    return None


# ---------------- Researcher: evidence management ----------------

@router.post("/{case_id}/evidence", response_model=EvidenceItemOut, status_code=201)
def add_evidence_item(
    case_id: int,
    label: str = Form(...),
    description: str = Form(...),
    is_contradictory_by_design: bool = Form(False),
    file: UploadFile | None = File(None),
    researcher: User = Depends(require_researcher),
    db: Session = Depends(get_db),
):
    """
    Add an evidence item to a case. Accepts multipart/form-data so an
    optional file (photo/document) can be uploaded alongside the
    description fields.
    """
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    file_path = None


if file is not None:
    from app.services.storage import save_upload
    file_path = save_upload(file.file, file.filename, case_id)

    item = EvidenceItem(
        case_id=case_id,
        label=label,
        description=description,
        is_contradictory_by_design=is_contradictory_by_design,
        file_path=file_path,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return (item)


@router.patch("/{case_id}/evidence/{evidence_id}", response_model=EvidenceItemOut)
def edit_evidence_item(
    case_id: int,
    evidence_id: int,
    label: str = Form(None),
    description: str = Form(None),
    is_contradictory_by_design: bool = Form(None),
    file: UploadFile | None = File(None),
    researcher: User = Depends(require_researcher),
    db: Session = Depends(get_db),
):
    """
    Edit an existing evidence item. All fields are optional — only
    supplied fields are updated. A new file upload replaces the old one.
    """
    item = db.query(EvidenceItem).filter(EvidenceItem.id ==
                                         evidence_id, EvidenceItem.case_id == case_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Evidence item not found")

    if label is not None:
        item.label = label
    if description is not None:
        item.description = description
    if is_contradictory_by_design is not None:
        item.is_contradictory_by_design = is_contradictory_by_design

    file_path = None


if file is not None:
    from app.services.storage import save_upload
    item.file_path = save_upload(file.file, file.filename, case_id)

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{case_id}/evidence/{evidence_id}", status_code=204)
def delete_evidence_item(case_id: int, evidence_id: int, researcher: User = Depends(require_researcher), db: Session = Depends(get_db)):
    item = db.query(EvidenceItem).filter(EvidenceItem.id ==
                                         evidence_id, EvidenceItem.case_id == case_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Evidence item not found")
    db.delete(item)
    db.commit()
    return None


# ---------------- Participant: case access ----------------

@router.get("/participant/available", response_model=List[CaseParticipantOut])
def list_available_cases(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns all active cases available for participants to start a session on."""
    return db.query(Case).filter(Case.is_active == True).all()  # noqa: E712


@router.get("/participant/{case_id}", response_model=CaseParticipantOut)
def get_case_participant(case_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id, Case.is_active == True).first()  # noqa: E712
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case
