from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id         = Column(Integer, primary_key=True, index=True)
    rating     = Column(Integer, nullable=False)   # 1–5
    content    = Column(String(1000), nullable=True)
    report_id  = Column(Integer, ForeignKey("reports.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "report_id", name="uq_user_report_review"),
    )

    report = relationship("Report", back_populates="reviews")
    user   = relationship("User",   back_populates="reviews")
