from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Enum, Text
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from datetime import datetime
from typing import Optional
import enum

from .db import Base

class Role(str, enum.Enum):
    employee = "employee"
    admin = "admin"

class SpaceType(str, enum.Enum):
    desk = "desk"
    office = "office"
    small_room = "small_room"
    training_room = "training_room"
    meeting_room = "meeting_room"
    wellbeing_zone = "wellbeing_zone"
    beer_point = "beer_point"

class ActivityType(str, enum.Enum):
    focus = "focus"           # individual work
    meeting = "meeting"       # team meeting, 1:1
    training = "training"     # trainings
    relaxation = "relaxation" # wellbeing / fun

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.employee, nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    bookings = relationship("Booking", back_populates="user")

class Space(Base):
    __tablename__ = "spaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    type: Mapped[SpaceType] = mapped_column(Enum(SpaceType), nullable=False, index=True)
    activity: Mapped[ActivityType] = mapped_column(Enum(ActivityType), nullable=False, index=True)
    capacity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    requires_approval: Mapped[bool] = mapped_column(Boolean, default=False)
    is_bookable: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    bookings = relationship("Booking", back_populates="space")

class BookingStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"

class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    space_id: Mapped[int] = mapped_column(ForeignKey("spaces.id"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    attendees: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    start_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_utc: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.pending, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="bookings")
    space = relationship("Space", back_populates="bookings")
