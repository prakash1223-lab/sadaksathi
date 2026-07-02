from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from core.database import get_db
from core.security import get_current_user, hash_password, verify_password
from models.user import User
from models.report import Report, SeverityEnum, StatusEnum

router = APIRouter(prefix="/users", tags=["users"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    name: str
    phone: str
    email: Optional[str]
    is_admin: bool
    joined_date: Optional[str]
    avatar_initials: str
    class Config:
        from_attributes = True


class Stats(BaseModel):
    total_reports: int
    pending: int
    in_progress: int
    fixed: int
    total_upvotes_received: int
    reports_this_month: int
    impact_score: int


class MonthlyPoint(BaseModel):
    month: str   # "Jan", "Feb", …
    count: int


class ReporterOut(BaseModel):
    id: int
    name: str
    phone: str
    class Config:
        from_attributes = True


class ReportOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    latitude: float
    longitude: float
    address: Optional[str]
    severity: SeverityEnum
    status: StatusEnum
    damage_type: Optional[str]
    photo_url: Optional[str]
    upvotes: int
    reporter_id: int
    reporter: ReporterOut
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True


class ProfileResponse(BaseModel):
    user: UserOut
    stats: Stats
    reports: List[ReportOut]
    monthly_data: List[MonthlyPoint]
    streak: int          # consecutive days with at least 1 report up to today
    rank: Optional[int]  # city rank by impact score (None if not ranked yet)


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    name: str
    avatar_initials: str
    total_reports: int
    fixed: int
    impact_score: int


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_initials(name: str) -> str:
    parts = name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return name[:2].upper() if len(name) >= 2 else name.upper()


def compute_stats(reports: list) -> Stats:
    total       = len(reports)
    pending     = sum(1 for r in reports if r.status == StatusEnum.pending)
    in_progress = sum(1 for r in reports if r.status == StatusEnum.in_progress)
    fixed       = sum(1 for r in reports if r.status == StatusEnum.fixed)
    upvotes     = sum(r.upvotes for r in reports)
    now         = datetime.now(timezone.utc)
    this_month  = sum(
        1 for r in reports
        if r.created_at.year == now.year and r.created_at.month == now.month
    )
    impact = (fixed * 20) + (upvotes * 2) + (total * 5)
    return Stats(
        total_reports=total, pending=pending, in_progress=in_progress,
        fixed=fixed, total_upvotes_received=upvotes,
        reports_this_month=this_month, impact_score=impact,
    )


def compute_monthly(reports: list) -> List[MonthlyPoint]:
    """Last 6 calendar months including current month."""
    now   = datetime.now(timezone.utc)
    buckets: dict[tuple, int] = {}
    for i in range(5, -1, -1):
        # go back i months
        month = now.month - i
        year  = now.year
        while month <= 0:
            month += 12
            year  -= 1
        buckets[(year, month)] = 0

    for r in reports:
        key = (r.created_at.year, r.created_at.month)
        if key in buckets:
            buckets[key] += 1

    MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return [
        MonthlyPoint(month=MONTH_NAMES[m - 1], count=cnt)
        for (_, m), cnt in buckets.items()
    ]


def compute_streak(reports: list) -> int:
    """Count consecutive calendar days ending today that have at least 1 report."""
    if not reports:
        return 0
    days_with_report = {r.created_at.date() for r in reports}
    streak = 0
    day = datetime.now(timezone.utc).date()
    while day in days_with_report:
        streak += 1
        day -= timedelta(days=1)
    return streak


def compute_rank(user_id: int, user_impact: int, db: Session) -> Optional[int]:
    """Rank among all users by impact score (lower rank = higher score)."""
    all_users = db.query(User).all()
    scores = []
    for u in all_users:
        reports = db.query(Report).filter(Report.reporter_id == u.id).all()
        s = compute_stats(reports)
        scores.append((u.id, s.impact_score))
    scores.sort(key=lambda x: x[1], reverse=True)
    for i, (uid, _) in enumerate(scores, start=1):
        if uid == user_id:
            return i
    return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/profile", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reports = (
        db.query(Report)
        .filter(Report.reporter_id == current_user.id)
        .order_by(Report.created_at.desc())
        .all()
    )
    stats        = compute_stats(reports)
    monthly_data = compute_monthly(reports)
    streak       = compute_streak(reports)
    rank         = compute_rank(current_user.id, stats.impact_score, db)
    joined       = current_user.created_at.strftime("%Y-%m-%d") if current_user.created_at else None

    return ProfileResponse(
        user=UserOut(
            id=current_user.id, name=current_user.name, phone=current_user.phone,
            email=current_user.email, is_admin=current_user.is_admin,
            joined_date=joined, avatar_initials=get_initials(current_user.name),
        ),
        stats=stats,
        reports=reports,
        monthly_data=monthly_data,
        streak=streak,
        rank=rank,
    )


@router.get("/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(db: Session = Depends(get_db)):
    """Top 10 reporters by impact score."""
    all_users = db.query(User).all()
    entries = []
    for u in all_users:
        reports = db.query(Report).filter(Report.reporter_id == u.id).all()
        s = compute_stats(reports)
        entries.append({
            "user_id": u.id,
            "name": u.name,
            "avatar_initials": get_initials(u.name),
            "total_reports": s.total_reports,
            "fixed": s.fixed,
            "impact_score": s.impact_score,
        })
    entries.sort(key=lambda x: x["impact_score"], reverse=True)
    return [LeaderboardEntry(rank=i + 1, **e) for i, e in enumerate(entries[:10])]


@router.patch("/profile", response_model=UserOut)
def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if req.name is not None:
        name = req.name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
        current_user.name = name
    if req.email is not None:
        current_user.email = req.email.strip() or None
    db.commit()
    db.refresh(current_user)
    return UserOut(
        id=current_user.id, name=current_user.name, phone=current_user.phone,
        email=current_user.email, is_admin=current_user.is_admin,
        joined_date=current_user.created_at.strftime("%Y-%m-%d") if current_user.created_at else None,
        avatar_initials=get_initials(current_user.name),
    )


@router.patch("/change-password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    if req.new_password != req.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    current_user.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
