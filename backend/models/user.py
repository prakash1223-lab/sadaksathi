from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # ── Notification preferences ───────────────────────────────────────────
    notification_status_updates = Column(Boolean, default=True)
    notification_confirmations  = Column(Boolean, default=True)
    notification_nearby         = Column(Boolean, default=True)
    notification_nearby_radius  = Column(Integer, default=2)
    notification_reminder       = Column(Boolean, default=False)
    notification_municipality   = Column(Boolean, default=False)
    notification_fixed_alerts   = Column(Boolean, default=True)

    # ── Privacy preferences ────────────────────────────────────────────────
    privacy_show_name       = Column(Boolean, default=True)
    privacy_anonymous       = Column(Boolean, default=False)
    privacy_public_profile  = Column(Boolean, default=True)
    privacy_leaderboard     = Column(Boolean, default=True)
    privacy_exact_location  = Column(Boolean, default=True)
    privacy_blur_location   = Column(Boolean, default=False)

    # ── Location preferences ───────────────────────────────────────────────
    location_auto_detect  = Column(Boolean, default=True)
    location_auto_attach  = Column(Boolean, default=True)
    location_default_area = Column(String, default="Kathmandu")

    # ── Map preferences ────────────────────────────────────────────────────
    map_default_view  = Column(String,  default="pins")
    map_default_zoom  = Column(Integer, default=13)
    map_show_fixed    = Column(Boolean, default=True)
    map_show_labels   = Column(Boolean, default=True)
    map_cluster_pins  = Column(Boolean, default=True)

    # ── Reporting preferences ──────────────────────────────────────────────
    report_auto_ai       = Column(Boolean, default=True)
    report_save_photos   = Column(Boolean, default=False)
    report_require_photo = Column(Boolean, default=True)
    report_offline_mode  = Column(Boolean, default=True)
    report_auto_sync     = Column(Boolean, default=True)

    # ── Account preferences ────────────────────────────────────────────────
    account_language = Column(String, default="en")
    account_theme    = Column(String, default="system")

    reports       = relationship("Report",          back_populates="reporter")
    notifications = relationship("Notification",    back_populates="user")
    sos_contacts  = relationship("CustomSosContact",back_populates="user")
