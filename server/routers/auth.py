from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Role
from ..schemas import UserCreate, UserOut, LoginRequest, Token
from ..auth import (
    create_access_token,
    verify_password,
    hash_password,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Helpers ----------
def _map_role(role_str: str) -> Role:
    rs = (role_str or "").strip().lower()
    if rs in ("admin", "manager"):
        return Role.admin
    return Role.employee


# ---------- Routes ----------
@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = _map_role(payload.role)
    user = User(
        email=payload.email.strip().lower(),
        full_name=payload.full_name.strip(),
        password_hash=hash_password(payload.password),
        role=role,
        avatar_url=(payload.avatar_url or None),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT token"""
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/verify", response_model=UserOut)
def verify(current_user: User = Depends(get_current_user)):
    """Verify current token and return user info"""
    return current_user
