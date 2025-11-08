from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timezone
from typing import List, Optional

from ..db import get_db
from ..auth import get_current_user, require_admin
from ..models import Booking, Space, BookingStatus, User
from ..schemas import BookingCreate, BookingOut

router = APIRouter(prefix="/bookings", tags=["bookings"])

def overlap(a_start, a_end, b_start, b_end):
    return not (a_end <= b_start or a_start >= b_end)

@router.post("", response_model=BookingOut)
def create_booking(payload: BookingCreate, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    if payload.end_utc <= payload.start_utc:
        raise HTTPException(status_code=400, detail="End must be after start")

    space = db.get(Space, payload.space_id)
    if not space or not space.is_bookable:
        raise HTTPException(status_code=404, detail="Space not bookable")

    if payload.attendees > space.capacity:
        raise HTTPException(status_code=400, detail=f"Attendees exceed capacity ({space.capacity})")

    # Conflict check
    conflicts = (
        db.query(Booking)
        .filter(Booking.space_id == payload.space_id, Booking.status.in_([BookingStatus.pending, BookingStatus.approved]))
        .all()
    )
    for b in conflicts:
        if overlap(payload.start_utc, payload.end_utc, b.start_utc, b.end_utc):
            raise HTTPException(status_code=409, detail="Time conflict with existing booking")

    status = BookingStatus.pending if space.requires_approval else BookingStatus.approved

    booking = Booking(
        user_id=current.id,
        space_id=payload.space_id,
        title=payload.title,
        attendees=payload.attendees,
        start_utc=payload.start_utc,
        end_utc=payload.end_utc,
        status=status,
        notes=payload.notes,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

@router.get("/mine", response_model=List[BookingOut])
def my_bookings(db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    return (
        db.query(Booking)
        .filter(Booking.user_id == current.id)
        .order_by(Booking.start_utc.desc())
        .all()
    )

@router.delete("/{booking_id}")
def cancel_booking(booking_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    b = db.get(Booking, booking_id)
    if not b or b.user_id != current.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.status in [BookingStatus.cancelled, BookingStatus.rejected]:
        return {"ok": True}
    b.status = BookingStatus.cancelled
    db.commit()
    return {"ok": True}

@router.get("/pending", response_model=List[BookingOut])
def pending_bookings(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(Booking).filter(Booking.status == BookingStatus.pending).order_by(Booking.start_utc.asc()).all()

@router.post("/{booking_id}/approve", response_model=BookingOut)
def approve_booking(booking_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    b.status = BookingStatus.approved
    db.commit()
    db.refresh(b)
    return b

@router.post("/{booking_id}/reject", response_model=BookingOut)
def reject_booking(booking_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")
    b.status = BookingStatus.rejected
    db.commit()
    db.refresh(b)
    return b
