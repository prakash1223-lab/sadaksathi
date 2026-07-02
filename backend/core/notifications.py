"""Shared helper to create notifications."""
from sqlalchemy.orm import Session
from models.notification import Notification


def create_notification(db: Session, user_id: int, report_id: int, notif_type: str, message: str):
    n = Notification(
        user_id=user_id,
        report_id=report_id,
        type=notif_type,
        message=message,
    )
    db.add(n)
    # caller must commit
