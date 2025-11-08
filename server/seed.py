from sqlalchemy.orm import Session
from .db import engine, Base, SessionLocal
from .models import Space, SpaceType, ActivityType, User, Role
from .auth import hash_password

def create_spaces() -> list[Space]:
    spaces: list[Space] = []

    # --- DESKS ---
    # 216 desks, bookable only in whole-day blocks (frontend enforces; recommend backend validation too)
    for i in range(1, 217):
        spaces.append(
            Space(
                name=f"Desk {i}",
                type=SpaceType.desk,
                activity=ActivityType.focus,
                capacity=1,
                description=f"Desk number {i} (whole-day only, up to 7 days)",
            )
        )

    # --- OFFICES ---
    # Removed: offices can no longer be booked (do not seed any)
    # (If you still have existing Office rows from old seeds, consider a one-off migration to delete them.)

    # --- SMALL ROOMS ---
    # 6 x 4 people
    for i in range(1, 7):
        spaces.append(
            Space(
                name=f"Small Room 4p #{i}",
                type=SpaceType.small_room,
                activity=ActivityType.meeting,
                capacity=4,
                description=f"Small meeting room for 4 people (#{i})",
            )
        )
    # 4 x 2 people
    for i in range(1, 5):
        spaces.append(
            Space(
                name=f"Small Room 2p #{i}",
                type=SpaceType.small_room,
                activity=ActivityType.meeting,
                capacity=2,
                description=f"Small meeting room for 2 people (#{i})",
            )
        )
    # 4 x 1 person
    for i in range(1, 5):
        spaces.append(
            Space(
                name=f"Small Room 1p #{i}",
                type=SpaceType.small_room,
                activity=ActivityType.meeting,
                capacity=1,
                description=f"Focus/small room for 1 person (#{i})",
            )
        )

    # --- WELLBEING ZONES ---
    # Massage chairs (2) and Bookster area (4)
    spaces.append(
        Space(
            name="Massage Chairs",
            type=SpaceType.wellbeing_zone,
            activity=ActivityType.relaxation,
            capacity=2,
            description="Wellbeing zone — massage chairs (2 seats)",
        )
    )
    spaces.append(
        Space(
            name="Bookster Area",
            type=SpaceType.wellbeing_zone,
            activity=ActivityType.relaxation,
            capacity=4,
            description="Wellbeing zone — Bookster reading area (4 seats)",
        )
    )

    # --- BEER POINT ---
    # Keep as-is (not mentioned to remove)
    spaces.append(
        Space(
            name="Beer Point",
            type=SpaceType.beer_point,
            activity=ActivityType.relaxation,
            capacity=50,
            requires_approval=True,
            description="Pool tables, fridges, and chill area",
        )
    )

    # --- TRAINING ROOMS ---
    # Two individual rooms + one “Both” combined option (selectable as a single space)
    spaces.append(
        Space(
            name="Training Room 1",
            type=SpaceType.training_room,
            activity=ActivityType.training,
            capacity=18,
            requires_approval=True,
            description="Training room with 18 seats",
        )
    )
    spaces.append(
        Space(
            name="Training Room 2",
            type=SpaceType.training_room,
            activity=ActivityType.training,
            capacity=19,
            requires_approval=True,
            description="Training room with 19 seats",
        )
    )
    spaces.append(
        Space(
            name="Training Rooms (Both)",
            type=SpaceType.training_room,
            activity=ActivityType.training,
            capacity=18 + 19,
            requires_approval=True,
            description="Combined Training Rooms 1+2 (both rooms as one booking)",
        )
    )

    return spaces

def seed():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # demo users
        if not db.query(User).first():
            admin = User(
                email="admin@example.com",
                full_name="Admin User",
                password_hash=hash_password("Hackathon@1234"),
                role=Role.admin,
            )
            user = User(
                email="test@example.com",
                full_name="Test User",
                password_hash=hash_password("Hackathon@1234"),
                role=Role.employee,
            )
            db.add_all([admin, user])

        # wipe & reseed spaces
        db.query(Space).delete()
        db.add_all(create_spaces())

        db.commit()
        print("Seed completed.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
