from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas import UserOut
from ..auth import get_current_user
from ..models import User

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return current
