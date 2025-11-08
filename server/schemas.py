from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from .models import Role, SpaceType, ActivityType, BookingStatus

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: Role
    avatar_url: Optional[str] = None

class UserCreate(BaseModel):
    # accept role as a plain string to allow "manager" while keeping DB enum unchanged
    email: EmailStr
    full_name: str
    password: str
    role: str = "employee"          # "employee" | "manager" | "admin"
    avatar_url: Optional[str] = None

class UserOut(UserBase):
    id: int
    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class SpaceCreate(BaseModel):
    name: str
    type: SpaceType
    activity: ActivityType
    capacity: int = 1
    requires_approval: bool = False
    is_bookable: bool = True
    description: Optional[str] = None

class SpaceOut(SpaceCreate):
    id: int
    class Config:
        from_attributes = True

class BookingCreate(BaseModel):
    space_id: int
    title: str
    attendees: int = Field(1, ge=1)
    start_utc: datetime
    end_utc: datetime
    notes: Optional[str] = None

class BookingOut(BaseModel):
    id: int
    user_id: int
    space_id: int
    title: str
    attendees: int
    start_utc: datetime
    end_utc: datetime
    status: BookingStatus
    notes: Optional[str] = None
    space: SpaceOut
    class Config:
        from_attributes = True
