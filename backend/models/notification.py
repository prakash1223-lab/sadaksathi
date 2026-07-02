from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_id  = Column(Integer, ForeignKey("reports.id"), nullable=True)
    type       = Column(String, nullable=False)   # upvote_milestone | status_in_progress | status_fixed
    message    = Column(String, nullable=False)
    is_read    = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user   = relationship("User",   back_populates="notifications")
    report = relationship("Report", back_populates="notifications")
