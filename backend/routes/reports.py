from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import aiofiles, os, uuid

from core.database import get_db
from core.security import get_current_user, get_current_admin
from core.config import settings
from core.notifications import create_notification
from models.report import Report, SeverityEnum, StatusEnum
from models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Schemas ───────────────────────────────────────────────────────────────────

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
    ai_confidence: Optional[float]
    reporter_id: int
    reporter: ReporterOut
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True
class ReportUpdate(BaseModel):
    status: Optional[StatusEnum] = None
    damage_type: Optional[str] = None
    severity: Optional[SeverityEnum] = None


# ── Helper: save upload ───────────────────────────────────────────────────────

async def _save_upload(photo: UploadFile) -> tuple[str, str]:
    """Save uploaded file, return (photo_url, local_path)."""
    ext      = os.path.splitext(photo.filename)[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    path     = os.path.join(settings.UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await photo.read())
    return f"/uploads/{filename}", path


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[ReportOut])
def list_reports(
    status: Optional[StatusEnum] = None,
    severity: Optional[SeverityEnum] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Report)
    if status:   q = q.filter(Report.status   == status)
    if severity: q = q.filter(Report.severity == severity)
    return q.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()


class HeatmapPoint(BaseModel):
    lat: float
    lng: float
    intensity: float

@router.get("/heatmap", response_model=List[HeatmapPoint])
def get_heatmap(db: Session = Depends(get_db)):
    intensity_map = {SeverityEnum.low: 0.3, SeverityEnum.medium: 0.6, SeverityEnum.high: 1.0}
    reports = db.query(Report.latitude, Report.longitude, Report.severity).all()
    return [{"lat": r.latitude, "lng": r.longitude, "intensity": intensity_map[r.severity]} for r in reports]


@router.get("/{report_id}", response_model=ReportOut)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report


@router.post("", response_model=ReportOut, status_code=201)
async def create_report(
    title: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    severity: SeverityEnum = Form(...),
    description: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    photo_url    = None
    ai_damage    = None
    ai_confidence = None
    final_severity = severity

    if photo and photo.filename:
        photo_url, local_path = await _save_upload(photo)

        # Run AI classifier on the saved image
        try:
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
            from ai.classifier import analyze_road_image
            result = analyze_road_image(local_path)
            ai_damage     = result["damage_type"]
            ai_confidence = result["confidence"]

            # Use AI severity suggestion only if user left it at default 'medium'
            # and AI is reasonably confident
            if severity == SeverityEnum.medium and ai_confidence >= 0.5:
                suggested = result["severity_suggestion"]
                if suggested in SeverityEnum.__members__:
                    final_severity = SeverityEnum(suggested)
        except Exception as e:
            print(f"[AI] Classifier error (non-fatal): {e}")

    report = Report(
        title=title,
        description=description,
        latitude=latitude,
        longitude=longitude,
        address=address,
        severity=final_severity,
        photo_url=photo_url,
        damage_type=ai_damage,
        ai_confidence=ai_confidence,
        reporter_id=current_user.id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@router.post("/{report_id}/upvote", response_model=ReportOut)
def upvote_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from models.upvote import Upvote
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.reporter_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot upvote your own report")
    existing = db.query(Upvote).filter(Upvote.user_id==current_user.id, Upvote.report_id==report_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already upvoted")
    db.add(Upvote(user_id=current_user.id, report_id=report_id))
    report.upvotes += 1
    milestones = {5, 10, 25, 50}
    if report.upvotes in milestones:
        loc = report.address or f"{report.latitude:.4f}, {report.longitude:.4f}"
        create_notification(db, report.reporter_id, report.id, "upvote_milestone",
            f"👍 {report.upvotes} people confirmed your report on {loc}!")
    db.commit()
    db.refresh(report)
    return report


@router.patch("/{report_id}", response_model=ReportOut)
def update_report(
    report_id: int,
    updates: ReportUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    for field, value in updates.model_dump(exclude_none=True).items():
        setattr(report, field, value)
    db.commit()
    db.refresh(report)
    return report


@router.delete("/{report_id}", status_code=204)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
