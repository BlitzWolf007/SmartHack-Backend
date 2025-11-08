#from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from ..models import Booking, Space, BookingStatus, User, Role


from ..db import get_db
from ..auth import get_current_user, require_admin
from ..models import Booking, Space, BookingStatus, User
from ..schemas import BookingCreate, BookingOut

router = APIRouter(prefix="/bookings", tags=["bookings"])

def norm_utc(dt: datetime) -> datetime:
    """Return a timezone-aware UTC datetime; treat naive values as UTC."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def overlap(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """All inputs must be UTC-aware."""
    return not (a_end <= b_start or a_start >= b_end)

@router.post("", response_model=BookingOut)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    # Normalize request datetimes to aware UTC
    start = norm_utc(payload.start_utc)
    end = norm_utc(payload.end_utc)

    if end <= start:
        raise HTTPException(status_code=400, detail="End must be after start")

    space = db.get(Space, payload.space_id)
    if not space or not space.is_bookable:
        raise HTTPException(status_code=404, detail="Space not bookable")

    if payload.attendees > space.capacity:
        raise HTTPException(status_code=400, detail=f"Attendees exceed capacity ({space.capacity})")

    # Conflict check (normalize DB values too because SQLite can return naive datetimes)
    conflicts = (
        db.query(Booking)
        .filter(
            Booking.space_id == payload.space_id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.approved]),
        )
        .all()
    )
    for b in conflicts:
        b_start = norm_utc(b.start_utc)
        b_end = norm_utc(b.end_utc)
        if overlap(start, end, b_start, b_end):
            raise HTTPException(status_code=409, detail="Time conflict with existing booking")

    is_manager = current.role == Role.admin  # Role.admin is our "manager"
    status = BookingStatus.approved if (is_manager or not space.requires_approval) else BookingStatus.pending

    booking = Booking(
        user_id=current.id,
        space_id=payload.space_id,
        title=payload.title,
        attendees=payload.attendees,
        start_utc=start,
        end_utc=end,
        status=status,
        notes=payload.notes,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

@router.get("/mine", response_model=List[BookingOut])
def my_bookings(
    include_cancelled: bool = Query(False, description="Include cancelled/rejected in results"),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    q = db.query(Booking).filter(Booking.user_id == current.id)
    if not include_cancelled:
        q = q.filter(Booking.status.in_([BookingStatus.pending, BookingStatus.approved]))
    return q.order_by(Booking.start_utc.desc()).all()

@router.delete("/{booking_id}")
def cancel_booking(booking_id: int, db: Session = Depends(get_db), current: User = Depends(get_current_user)):
    b = db.get(Booking, booking_id)
    if not b or b.user_id != current.id:
        raise HTTPException(status_code=404, detail="Booking not found")
    if b.status in [BookingStatus.cancelled, BookingStatus.rejected]:
        return {"ok": True, "id": booking_id, "message": "booking cancelled"}
    b.status = BookingStatus.cancelled
    db.commit()
    return {"ok": True, "id": booking_id, "message": "booking cancelled"}


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
