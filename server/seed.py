from sqlalchemy.orm import Session
from .db import engine, Base, SessionLocal
from .models import Space, SpaceType, ActivityType, User, Role
from .auth import hash_password

def create_spaces() -> list[Space]:
    spaces = []

    # 216 desks
    for i in range(1, 217):
        spaces.append(
            Space(
                name=f"Desk {i}",
                type=SpaceType.desk,
                activity=ActivityType.focus,
                capacity=1,
                description=f"Desk number {i}",
            )
        )

    # 3 offices
    for i in range(1, 4):
        spaces.append(
            Space(
                name=f"Office {i}",
                type=SpaceType.room,
                activity=ActivityType.focus,
                capacity=4,
                requires_approval=True,
                description=f"Private office {i}",
            )
        )

    # 10 small meeting rooms
    for i in range(1, 11):
        spaces.append(
            Space(
                name=f"Small Room {i}",
                type=SpaceType.room,
                activity=ActivityType.meeting,
                capacity=4,
                description=f"Small meeting room {i}",
            )
        )

    # 2 wellbeing zones
    for i in range(1, 3):
        spaces.append(
            Space(
                name=f"Wellbeing Zone {i}",
                type=SpaceType.facility,
                activity=ActivityType.relaxation,
                capacity=1,
                description=f"Relaxation area {i}",
            )
        )

    # 1 beer point
    spaces.append(
        Space(
            name="Beer Point",
            type=SpaceType.facility,
            activity=ActivityType.relaxation,
            capacity=50,
            requires_approval=True,
            description="Pool tables, fridges, and chill area",
        )
    )

    # 2 training rooms
    spaces.append(
        Space(
            name="Training Room 1",
            type=SpaceType.room,
            activity=ActivityType.training,
            capacity=18,
            requires_approval=True,
            description="Training room with 18 seats",
        )
    )
    spaces.append(
        Space(
            name="Training Room 2",
            type=SpaceType.room,
            activity=ActivityType.training,
            capacity=19,
            requires_approval=True,
            description="Training room with 19 seats",
        )
    )

    return spaces


def seed():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        if not db.query(User).first():
            admin = User(email="admin@example.com", full_name="Admin User", password_hash=hash_password("Hackathon@1234"), role=Role.admin)
            user = User(email="test@example.com", full_name="Test User", password_hash=hash_password("Hackathon@1234"), role=Role.employee)
            db.add_all([admin, user])

        db.query(Space).delete()
        db.add_all(create_spaces())

        db.commit()
        print("Seed completed.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
