"""
seed.py — populate the database with a demo user and 10 fake reports
around Kathmandu so the map looks alive on first run.

Usage (from sadaksathi/backend/):
    python seed.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from core.database import SessionLocal, engine, Base
from core.security import hash_password
from models.user import User
from models.report import Report, SeverityEnum, StatusEnum

Base.metadata.create_all(bind=engine)

SEED_USER = {
    "name": "Demo User",
    "phone": "9800000000",
    "email": "demo@sadaksathi.np",
    "password": "demo1234",
}

SEED_REPORTS = [
    {
        "title": "Large pothole blocking lane",
        "description": "A large pothole has formed after monsoon rains. Vehicles swerving dangerously.",
        "latitude": 27.7041,
        "longitude": 85.3145,
        "address": "Ratnapark, Kathmandu",
        "severity": SeverityEnum.high,
        "status": StatusEnum.pending,
    },
    {
        "title": "Broken road surface near guest houses",
        "description": "Road surface broken up with exposed gravel. Motorbike hazard.",
        "latitude": 27.7154,
        "longitude": 85.3123,
        "address": "Thamel, Kathmandu",
        "severity": SeverityEnum.medium,
        "status": StatusEnum.in_progress,
    },
    {
        "title": "Cracked footpath and road edge",
        "description": "Footpath and road edge cracked, minor but spreading.",
        "latitude": 27.7089,
        "longitude": 85.3256,
        "address": "Putalisadak, Kathmandu",
        "severity": SeverityEnum.low,
        "status": StatusEnum.pending,
    },
    {
        "title": "Deep crater after water pipe work",
        "description": "Municipality dug up road for pipe work and left it unrepaired for 3 weeks.",
        "latitude": 27.6856,
        "longitude": 85.3456,
        "address": "Koteshwor, Kathmandu",
        "severity": SeverityEnum.high,
        "status": StatusEnum.pending,
    },
    {
        "title": "Collapsed road shoulder",
        "description": "Road shoulder has collapsed on uphill side. Risk during rain.",
        "latitude": 27.7310,
        "longitude": 85.3012,
        "address": "Balaju, Kathmandu",
        "severity": SeverityEnum.medium,
        "status": StatusEnum.pending,
    },
    {
        "title": "Surface erosion near Patan junction",
        "description": "Road surface eroded. Loose gravel on curve.",
        "latitude": 27.6588,
        "longitude": 85.3247,
        "address": "Patan Dhoka, Lalitpur",
        "severity": SeverityEnum.low,
        "status": StatusEnum.fixed,
    },
    {
        "title": "Road subsidence — landslide risk",
        "description": "Ground under road has subsided. Crack running 4m across carriageway. Urgent.",
        "latitude": 27.6710,
        "longitude": 85.4298,
        "address": "Bhaktapur Durbar Square road",
        "severity": SeverityEnum.high,
        "status": StatusEnum.in_progress,
    },
    {
        "title": "Pothole series on main artery",
        "description": "Series of 5-6 potholes in a row causing traffic slowdown.",
        "latitude": 27.6989,
        "longitude": 85.2812,
        "address": "Kalanki Chowk, Kathmandu",
        "severity": SeverityEnum.medium,
        "status": StatusEnum.pending,
    },
    {
        "title": "Broken manhole cover",
        "description": "Manhole cover missing. Open hole visible at night — very dangerous.",
        "latitude": 27.7198,
        "longitude": 85.3489,
        "address": "Chabahil, Kathmandu",
        "severity": SeverityEnum.high,
        "status": StatusEnum.pending,
    },
    {
        "title": "Minor crack near stupa road",
        "description": "Small longitudinal crack on road near the roundabout.",
        "latitude": 27.7215,
        "longitude": 85.3620,
        "address": "Boudha, Kathmandu",
        "severity": SeverityEnum.low,
        "status": StatusEnum.pending,
    },
]


def run():
    db = SessionLocal()
    try:
        # Skip if already seeded
        if db.query(User).filter(User.phone == SEED_USER["phone"]).first():
            print("✓ Database already seeded — skipping.")
            return

        # Create demo user
        user = User(
            name=SEED_USER["name"],
            phone=SEED_USER["phone"],
            email=SEED_USER["email"],
            hashed_password=hash_password(SEED_USER["password"]),
            is_admin=True,
        )
        db.add(user)
        db.flush()  # get user.id without committing

        # Create reports
        for data in SEED_REPORTS:
            report = Report(**data, reporter_id=user.id, upvotes=0)
            db.add(report)

        db.commit()
        print(f"✓ Seeded demo user  → phone: {SEED_USER['phone']}  password: {SEED_USER['password']}")
        print(f"✓ Seeded {len(SEED_REPORTS)} reports across Kathmandu")
        print()
        print("  Login at http://localhost:5173/login")

    except Exception as e:
        db.rollback()
        print(f"✗ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
