"""
Pydantic schemas for authentication and user representation.
"""
from app.core.deps import get_current_user
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: Optional[str] = None
    password: str = Field(..., min_length=8)
    role: Literal["participant", "researcher"] = "participant"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: Optional[str] = None
    role: str
    is_active: bool
    has_consented: bool
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/consent", response_model=UserOut)
def record_consent(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Records that the participant has given informed consent.
    Called once after registration when the participant clicks
    'I consent' on the consent page. Idempotent — safe to call
    multiple times.
    """
    current_user.has_consented = True
    db.commit()
    db.refresh(current_user)
    return current_user
