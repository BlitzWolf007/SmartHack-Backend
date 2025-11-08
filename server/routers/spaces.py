from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timezone
from typing import List, Optional

from ..db import get_db
from ..models import Space, SpaceType, ActivityType, Booking, BookingStatus
from ..schemas import SpaceOut

router = APIRouter(prefix="/spaces", tags=["spaces"])

@router.get("", response_model=List[SpaceOut])
def list_spaces(
    db: Session = Depends(get_db),
    type: Optional[SpaceType] = None,
    activity: Optional[ActivityType] = None,
    q: Optional[str] = None,
):
    query = db.query(Space).filter(Space.is_bookable == True)
    if type:
        query = query.filter(Space.type == type)
    if activity:
        query = query.filter(Space.activity == activity)
    if q:
        like = f"%{q.lower()}%"
        query = query.filter(or_(Space.name.ilike(like), Space.description.ilike(like)))
    return query.order_by(Space.name.asc()).all()

@router.get("/{space_id}/availability")
def availability(space_id: int, db: Session = Depends(get_db), date: Optional[str] = None):
    space = db.get(Space, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Space not found")

    # Determine day in UTC
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")
    else:
        d = datetime.now(timezone.utc).date()

    start = datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=timezone.utc)
    end = datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)

    bookings = (
        db.query(Booking)
        .filter(
            Booking.space_id == space_id,
            Booking.status.in_([BookingStatus.pending, BookingStatus.approved]),
            Booking.start_utc <= end,
            Booking.end_utc >= start,
        )
        .order_by(Booking.start_utc.asc())
        .all()
    )
    return {
        "space": SpaceOut.model_validate(space),
        "bookings": [
            {
                "id": b.id,
                "title": b.title,
                "start_utc": b.start_utc,
                "end_utc": b.end_utc,
                "status": b.status,
                "attendees": b.attendees,
            }
            for b in bookings
        ],
    }
