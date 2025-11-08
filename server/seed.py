from sqlalchemy.orm import Session
from .db import engine, Base, SessionLocal
from .models import Space, SpaceType, ActivityType, User, Role
from .auth import hash_password

def seed():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        if not db.query(User).first():
            admin = User(email="admin@example.com", full_name="Admin User", password_hash=hash_password("Hackathon@1234"), role=Role.admin)
            user = User(email="test@example.com", full_name="Test User", password_hash=hash_password("Hackathon@1234"), role=Role.employee)
            db.add_all([admin, user])

        if not db.query(Space).first():
            spaces = [
                Space(name="Desk A1", type=SpaceType.desk, activity=ActivityType.focus, capacity=1, description="Quiet desk by window"),
                Space(name="Desk A2", type=SpaceType.desk, activity=ActivityType.focus, capacity=1),
                Space(name="Hefeweizen Room", type=SpaceType.room, activity=ActivityType.meeting, capacity=6, description="Small meeting bubble"),
                Space(name="IPA Room", type=SpaceType.room, activity=ActivityType.meeting, capacity=12, requires_approval=True, description="Large meeting room"),
                Space(name="Training Room East", type=SpaceType.room, activity=ActivityType.training, capacity=25, requires_approval=True),
                Space(name="Beer Point", type=SpaceType.facility, activity=ActivityType.relaxation, capacity=12, requires_approval=True, description="Pool tables, fridges"),
                Space(name="Wellbeing Zone - Massage Chair", type=SpaceType.facility, activity=ActivityType.relaxation, capacity=1),
                Space(name="Wellbeing Zone - Bookster", type=SpaceType.facility, activity=ActivityType.relaxation, capacity=2),
            ]
            db.add_all(spaces)

        db.commit()
        print("Seed completed.")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
