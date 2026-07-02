from sqlalchemy import Column, Integer, String, Float, Text, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from core.database import Base

class SeverityEnum(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"

class StatusEnum(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    fixed = "fixed"

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String, nullable=True)
    severity = Column(Enum(SeverityEnum), nullable=False, default=SeverityEnum.medium)
    status = Column(Enum(StatusEnum), nullable=False, default=StatusEnum.pending)
    damage_type = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    upvotes = Column(Integer, default=0)
    ai_confidence = Column(Float, nullable=True)
    fixed_at = Column(DateTime(timezone=True), nullable=True)  # set when status→fixed
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    reporter = relationship("User", back_populates="reports")
    notifications = relationship("Notification", back_populates="report")
