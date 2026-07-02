from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from core.database import Base

class Upvote(Base):
    __tablename__ = "upvotes"
    id        = Column(Integer, primary_key=True, index=True)
    user_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    __table_args__ = (UniqueConstraint("user_id", "report_id", name="uq_user_report"),)
