from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional

from ..db import get_db
from ..schemas import UserOut
from ..auth import get_current_user, hash_password
from ..models import User

router = APIRouter(prefix="/users", tags=["users"])

# ---------- GET CURRENT USER ----------
@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    """Return the current logged-in user"""
    return current

# ---------- UPDATE CURRENT USER ----------
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    avatar_url: Optional[str] = None

@router.patch("/me", response_model=UserOut)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edit the currently logged-in user's profile"""
    # Check for email conflicts
    if data.email and data.email != current_user.email:
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = data.email

    if data.full_name:
        current_user.full_name = data.full_name

    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url

    if data.password:
        if len(data.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        current_user.password_hash = hash_password(data.password)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
