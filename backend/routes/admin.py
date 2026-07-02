from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import csv, io

from core.database import get_db
from core.security import get_current_admin
from core.notifications import create_notification
from models.report import Report, SeverityEnum, StatusEnum
from models.user import User

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ReporterMin(BaseModel):
    id: int
    name: str
    phone: str
    class Config:
        from_attributes = True


class AdminReportOut(BaseModel):
    id: int
    title: str
    description: Optional[str]
    address: Optional[str]
    latitude: float
    longitude: float
    severity: SeverityEnum
    status: StatusEnum
    damage_type: Optional[str]
    ai_confidence: Optional[float]
    photo_url: Optional[str]
    upvotes: int
    reporter: ReporterMin
    created_at: datetime
    updated_at: datetime
    fixed_at: Optional[datetime]
    class Config:
        from_attributes = True


class StatusUpdateRequest(BaseModel):
    status: StatusEnum


class AdminStatsOut(BaseModel):
    total_reports: int
    pending: int
    in_progress: int
    fixed: int
    high_severity: int
    medium_severity: int
    low_severity: int
    total_users: int
    reports_today: int
    reports_this_week: int
    most_affected_area: Optional[str]
    avg_fix_time_days: Optional[float]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStatsOut)
def admin_stats(
    admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start  = today_start - timedelta(days=now.weekday())

    all_r = db.query(Report).all()

    total       = len(all_r)
    pending     = sum(1 for r in all_r if r.status == StatusEnum.pending)
    in_progress = sum(1 for r in all_r if r.status == StatusEnum.in_progress)
    fixed_list  = [r for r in all_r if r.status == StatusEnum.fixed]
    fixed       = len(fixed_list)
    high        = sum(1 for r in all_r if r.severity == SeverityEnum.high)
    medium      = sum(1 for r in all_r if r.severity == SeverityEnum.medium)
    low         = sum(1 for r in all_r if r.severity == SeverityEnum.low)
    total_users = db.query(User).count()

    def aware(dt):
        if dt is None: return None
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

    reports_today = sum(
        1 for r in all_r if aware(r.created_at) and aware(r.created_at) >= today_start
    )
    reports_week = sum(
        1 for r in all_r if aware(r.created_at) and aware(r.created_at) >= week_start
    )

    # Most affected area — most common non-null address word
    areas: dict[str, int] = {}
    for r in all_r:
        if r.address:
            part = r.address.split(',')[0].strip()
            areas[part] = areas.get(part, 0) + 1
    most_affected = max(areas, key=areas.__getitem__) if areas else None

    # Average fix time in days
    fix_times = []
    for r in fixed_list:
        if r.fixed_at and r.created_at:
            fa = aware(r.fixed_at)
            ca = aware(r.created_at)
            if fa and ca:
                fix_times.append((fa - ca).total_seconds() / 86400)
    avg_fix = round(sum(fix_times) / len(fix_times), 1) if fix_times else None

    return AdminStatsOut(
        total_reports=total, pending=pending, in_progress=in_progress, fixed=fixed,
        high_severity=high, medium_severity=medium, low_severity=low,
        total_users=total_users, reports_today=reports_today, reports_this_week=reports_week,
        most_affected_area=most_affected, avg_fix_time_days=avg_fix,
    )


@router.get("/reports", response_model=List[AdminReportOut])
def admin_reports(
    severity: Optional[SeverityEnum] = None,
    status:   Optional[StatusEnum]   = None,
    search:   Optional[str]          = None,
    sort:     str = Query("newest", pattern="^(newest|oldest|most_upvoted|highest_severity)$"),
    page:     int = Query(1, ge=1),
    limit:    int = Query(20, le=100),
    admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Report)
    if severity: q = q.filter(Report.severity == severity)
    if status:   q = q.filter(Report.status == status)
    if search:
        q = q.filter(Report.address.ilike(f"%{search}%") | Report.title.ilike(f"%{search}%"))

    SEV_ORDER = {"high": 3, "medium": 2, "low": 1}
    if sort == "newest":           q = q.order_by(desc(Report.created_at))
    elif sort == "oldest":         q = q.order_by(asc(Report.created_at))
    elif sort == "most_upvoted":   q = q.order_by(desc(Report.upvotes))
    elif sort == "highest_severity":
        # Sort by severity score then upvotes
        all_r = q.all()
        all_r.sort(key=lambda r: (SEV_ORDER.get(r.severity, 0), r.upvotes), reverse=True)
        start = (page - 1) * limit
        return all_r[start:start + limit]

    return q.offset((page - 1) * limit).limit(limit).all()


@router.patch("/reports/{report_id}/status", response_model=AdminReportOut)
def update_report_status(
    report_id: int,
    body: StatusUpdateRequest,
    admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    report.status = body.status
    if body.status == StatusEnum.fixed and report.fixed_at is None:
        report.fixed_at = datetime.now(timezone.utc)

    # Create notification for reporter
    loc = report.address or f"{report.latitude:.4f}, {report.longitude:.4f}"
    if body.status == StatusEnum.in_progress:
        create_notification(db, report.reporter_id, report.id,
            "status_in_progress",
            f"🔧 Good news! Municipality is working on the road you reported on {loc}")
    elif body.status == StatusEnum.fixed:
        create_notification(db, report.reporter_id, report.id,
            "status_fixed",
            f"✅ Great news! The road you reported on {loc} has been fixed! Thank you 🙏")

    db.commit()
    db.refresh(report)
    return report


@router.get("/export")
def export_csv(
    admin=Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    reports = (
        db.query(Report)
        .order_by(desc(Report.created_at))
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "ID", "Title", "Description", "Address", "Latitude", "Longitude",
        "Severity", "Status", "Damage Type", "AI Confidence",
        "Upvotes", "Reporter Name", "Reporter Phone",
        "Date Reported", "Date Fixed",
    ])

    for r in reports:
        writer.writerow([
            r.id, r.title, r.description or "", r.address or "",
            r.latitude, r.longitude,
            r.severity.value, r.status.value,
            r.damage_type or "", r.ai_confidence or "",
            r.upvotes,
            r.reporter.name if r.reporter else "",
            r.reporter.phone if r.reporter else "",
            r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
            r.fixed_at.strftime("%Y-%m-%d %H:%M") if r.fixed_at else "",
        ])

    output.seek(0)
    filename = f"sadaksathi_reports_{datetime.now().strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
