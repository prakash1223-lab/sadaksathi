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
    """
    Save uploaded photo.
    - Reads the file into memory.
    - Writes a temp copy to UPLOAD_DIR so the AI classifier can read it.
    - Returns (data_url, tmp_path).
      The data_url is a base64-encoded inline URL that works on any host
      without a filesystem dependency, so images survive Railway redeploys.
    """
    import base64, tempfile, io
    from PIL import Image as PILImage

    contents = await photo.read()
    ext = (os.path.splitext(photo.filename)[1] or ".jpg").lower().lstrip(".")
    mime = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "png": "image/png", "webp": "image/webp",
        "gif": "image/gif", "heic": "image/heic",
    }.get(ext, "image/jpeg")

    # Resize large images before storing to keep DB rows small (max 800px wide)
    try:
        img = PILImage.open(io.BytesIO(contents))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        if img.width > 800:
            ratio = 800 / img.width
            img = img.resize((800, int(img.height * ratio)), PILImage.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82)
        contents = buf.getvalue()
        mime = "image/jpeg"
        ext = "jpg"
    except Exception as e:
        print(f"[Upload] PIL resize failed (using original): {e}")

    # Write tmp file for AI classifier
    filename = f"{uuid.uuid4()}.{ext}"
    tmp_path = os.path.join(tempfile.gettempdir(), filename)
    with open(tmp_path, "wb") as f:
        f.write(contents)

    # Also write to UPLOAD_DIR as fallback (local dev)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    local_path = os.path.join(settings.UPLOAD_DIR, filename)
    with open(local_path, "wb") as f:
        f.write(contents)

    b64 = base64.b64encode(contents).decode("utf-8")
    data_url = f"data:{mime};base64,{b64}"
    return data_url, tmp_path


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


@router.delete("/{report_id}", status_code=200)
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from models.upvote import Upvote
    from models.comment import Comment
    from models.notification import Notification

    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    # Ownership check
    if not current_user.is_admin and report.reporter_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own reports")

    # Fixed reports are locked unless admin
    if report.status == "fixed" and not current_user.is_admin:
        raise HTTPException(status_code=400, detail="Fixed reports cannot be deleted")

    # Manually remove related rows that don't cascade via SQLAlchemy
    db.query(Upvote).filter(Upvote.report_id == report_id).delete()
    db.query(Comment).filter(Comment.report_id == report_id).delete()
    db.query(Notification).filter(Notification.report_id == report_id).delete()

    db.delete(report)
    db.commit()
    return {"message": "Report deleted successfully"}
