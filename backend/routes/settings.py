"""
Complete settings router for SadakSathi.
Endpoints: GET/PATCH all settings groups, export CSV/PDF, SOS contacts, delete account.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import csv, io

from core.database import get_db
from core.security import get_current_user, hash_password, verify_password
from models.user import User
from models.report import Report, StatusEnum
from models.notification import Notification
from models.sos_contact import CustomSosContact

router = APIRouter(prefix="/settings", tags=["settings"])


# ══════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════

class NotificationsIn(BaseModel):
    status_updates:  Optional[bool] = None
    confirmations:   Optional[bool] = None
    nearby:          Optional[bool] = None
    nearby_radius:   Optional[int]  = None
    reminder:        Optional[bool] = None
    municipality:    Optional[bool] = None
    fixed_alerts:    Optional[bool] = None

class MapIn(BaseModel):
    default_view: Optional[str]  = None
    default_zoom: Optional[int]  = None
    show_fixed:   Optional[bool] = None
    show_labels:  Optional[bool] = None
    cluster_pins: Optional[bool] = None

class ReportingIn(BaseModel):
    auto_ai:       Optional[bool] = None
    save_photos:   Optional[bool] = None
    require_photo: Optional[bool] = None
    offline_mode:  Optional[bool] = None
    auto_sync:     Optional[bool] = None

class PrivacyIn(BaseModel):
    show_name:      Optional[bool] = None
    anonymous:      Optional[bool] = None
    public_profile: Optional[bool] = None
    leaderboard:    Optional[bool] = None
    exact_location: Optional[bool] = None
    blur_location:  Optional[bool] = None

class AccountIn(BaseModel):
    language: Optional[str] = None
    theme:    Optional[str] = None

class ChangePasswordReq(BaseModel):
    current_password: str
    new_password: str

class DeleteAccountReq(BaseModel):
    password: str

class UpdateProfileReq(BaseModel):
    name:  Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class SosContactIn(BaseModel):
    name:   str
    number: str

class Achievement(BaseModel):
    name: str; unlocked: bool; icon: str

class ContributionsOut(BaseModel):
    total_reports: int; confirmations_received: int; roads_fixed: int
    impact_score: int; member_since: Optional[str]
    current_level: str; next_level: str
    points_to_next: int; progress_percent: int
    achievements: List[Achievement]


# ══════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════

def _all_settings(u: User) -> dict:
    return {
        "notifications": {
            "status_updates": bool(u.notification_status_updates),
            "confirmations":  bool(u.notification_confirmations),
            "nearby":         bool(u.notification_nearby),
            "nearby_radius":  u.notification_nearby_radius or 2,
            "reminder":       bool(u.notification_reminder),
            "municipality":   bool(u.notification_municipality),
            "fixed_alerts":   bool(u.notification_fixed_alerts),
        },
        "map": {
            "default_view": u.map_default_view or "pins",
            "default_zoom": u.map_default_zoom or 13,
            "show_fixed":   bool(u.map_show_fixed),
            "show_labels":  bool(u.map_show_labels),
            "cluster_pins": bool(u.map_cluster_pins),
        },
        "reporting": {
            "auto_ai":       bool(u.report_auto_ai),
            "save_photos":   bool(u.report_save_photos),
            "require_photo": bool(u.report_require_photo),
            "offline_mode":  bool(u.report_offline_mode),
            "auto_sync":     bool(u.report_auto_sync),
        },
        "privacy": {
            "show_name":      bool(u.privacy_show_name),
            "anonymous":      bool(u.privacy_anonymous),
            "public_profile": bool(u.privacy_public_profile),
            "leaderboard":    bool(u.privacy_leaderboard),
            "exact_location": bool(u.privacy_exact_location),
            "blur_location":  bool(u.privacy_blur_location),
        },
        "account": {
            "language": u.account_language or "en",
            "theme":    u.account_theme or "system",
        },
    }

def _level_info(score: int):
    levels = [
        (0,   50,  "New Reporter",      "Active Citizen"),
        (51,  150, "Active Citizen",    "Road Warrior"),
        (151, 300, "Road Warrior",      "Community Hero"),
        (301, 500, "Community Hero",    "SadakSathi Legend"),
        (501, 9999,"SadakSathi Legend", "SadakSathi Legend"),
    ]
    for lo, hi, cur, nxt in levels:
        if lo <= score <= hi:
            span = hi - lo or 1
            return cur, nxt, max(0, hi - score), min(int(((score-lo)/span)*100), 100)
    return "SadakSathi Legend", "SadakSathi Legend", 0, 100


# ══════════════════════════════════════════════════════════
# GET ALL SETTINGS
# ══════════════════════════════════════════════════════════

@router.get("")
def get_all_settings(u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _all_settings(u)


# ══════════════════════════════════════════════════════════
# PROFILE
# ══════════════════════════════════════════════════════════

@router.get("/profile")
def get_profile(u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"name": u.name, "phone": u.phone, "email": u.email, **_all_settings(u)}

@router.patch("/profile")
def update_profile(req: UpdateProfileReq, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.name  is not None: u.name  = req.name.strip()
    if req.phone is not None:
        taken = db.query(User).filter(User.phone == req.phone, User.id != u.id).first()
        if taken: raise HTTPException(400, "Phone number already in use")
        u.phone = req.phone.strip()
    if req.email is not None: u.email = req.email.strip() or None
    db.commit(); db.refresh(u)
    return {"name": u.name, "phone": u.phone, "email": u.email}

@router.patch("/password")
def change_password(req: ChangePasswordReq, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(req.current_password, u.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    if len(req.new_password) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    u.hashed_password = hash_password(req.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


# ══════════════════════════════════════════════════════════
# NOTIFICATIONS
# ══════════════════════════════════════════════════════════

@router.patch("/notifications")
def update_notifications(req: NotificationsIn, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.status_updates is not None: u.notification_status_updates = req.status_updates
    if req.confirmations  is not None: u.notification_confirmations  = req.confirmations
    if req.nearby         is not None: u.notification_nearby         = req.nearby
    if req.nearby_radius  is not None: u.notification_nearby_radius  = req.nearby_radius
    if req.reminder       is not None: u.notification_reminder       = req.reminder
    if req.municipality   is not None: u.notification_municipality   = req.municipality
    if req.fixed_alerts   is not None: u.notification_fixed_alerts   = req.fixed_alerts
    db.commit()
    return _all_settings(u)["notifications"]


# ══════════════════════════════════════════════════════════
# MAP
# ══════════════════════════════════════════════════════════

@router.patch("/map")
def update_map(req: MapIn, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.default_view is not None: u.map_default_view = req.default_view
    if req.default_zoom is not None: u.map_default_zoom = req.default_zoom
    if req.show_fixed   is not None: u.map_show_fixed   = req.show_fixed
    if req.show_labels  is not None: u.map_show_labels  = req.show_labels
    if req.cluster_pins is not None: u.map_cluster_pins = req.cluster_pins
    db.commit()
    return _all_settings(u)["map"]


# ══════════════════════════════════════════════════════════
# REPORTING
# ══════════════════════════════════════════════════════════

@router.patch("/reporting")
def update_reporting(req: ReportingIn, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.auto_ai       is not None: u.report_auto_ai       = req.auto_ai
    if req.save_photos   is not None: u.report_save_photos   = req.save_photos
    if req.require_photo is not None: u.report_require_photo = req.require_photo
    if req.offline_mode  is not None: u.report_offline_mode  = req.offline_mode
    if req.auto_sync     is not None: u.report_auto_sync     = req.auto_sync
    db.commit()
    return _all_settings(u)["reporting"]


# ══════════════════════════════════════════════════════════
# PRIVACY
# ══════════════════════════════════════════════════════════

@router.patch("/privacy")
def update_privacy(req: PrivacyIn, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.show_name      is not None: u.privacy_show_name      = req.show_name
    if req.anonymous      is not None: u.privacy_anonymous      = req.anonymous
    if req.public_profile is not None: u.privacy_public_profile = req.public_profile
    if req.leaderboard    is not None: u.privacy_leaderboard    = req.leaderboard
    if req.exact_location is not None: u.privacy_exact_location = req.exact_location
    if req.blur_location  is not None: u.privacy_blur_location  = req.blur_location
    db.commit()
    return _all_settings(u)["privacy"]


# ══════════════════════════════════════════════════════════
# ACCOUNT (language / theme)
# ══════════════════════════════════════════════════════════

@router.patch("/account")
def update_account(req: AccountIn, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.language is not None: u.account_language = req.language
    if req.theme    is not None: u.account_theme    = req.theme
    db.commit()
    result = _all_settings(u)["account"]
    # Return language in header too
    from fastapi.responses import JSONResponse
    resp = JSONResponse(content=result)
    resp.headers["Content-Language"] = result["language"]
    return resp


# ══════════════════════════════════════════════════════════
# CONTRIBUTIONS
# ══════════════════════════════════════════════════════════

@router.get("/contributions", response_model=ContributionsOut)
def get_contributions(u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    reports = db.query(Report).filter(Report.reporter_id == u.id).all()
    total   = len(reports)
    fixed   = sum(1 for r in reports if r.status == StatusEnum.fixed)
    upvotes = sum(r.upvotes for r in reports)
    impact  = (fixed * 20) + (upvotes * 2) + (total * 5)
    cur, nxt, to_next, progress = _level_info(impact)
    member_since = u.created_at.strftime("%Y-%m-%d") if u.created_at else None
    achievements = [
        {"name":"First Report",  "unlocked": total >= 1,    "icon":"map-pin"},
        {"name":"3 Reports",     "unlocked": total >= 3,    "icon":"flame"},
        {"name":"Top Reporter",  "unlocked": total >= 10,   "icon":"star"},
        {"name":"Road Hero",     "unlocked": fixed >= 3,    "icon":"shield"},
        {"name":"Legend",        "unlocked": impact >= 500, "icon":"crown"},
    ]
    return ContributionsOut(
        total_reports=total, confirmations_received=upvotes, roads_fixed=fixed,
        impact_score=impact, member_since=member_since,
        current_level=cur, next_level=nxt, points_to_next=to_next,
        progress_percent=progress, achievements=achievements,
    )


# ══════════════════════════════════════════════════════════
# EXPORT — CSV
# ══════════════════════════════════════════════════════════

@router.get("/export")
def export_reports(
    format: str = Query("csv", pattern="^(csv|pdf)$"),
    u: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reports = db.query(Report).filter(Report.reporter_id == u.id).order_by(Report.created_at.desc()).all()

    if format == "csv":
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(["ID","Title","Description","Address","Latitude","Longitude",
                    "Severity","Status","Damage Type","Upvotes","Date Reported","Date Fixed"])
        for r in reports:
            w.writerow([
                r.id, r.title, r.description or "", r.address or "",
                r.latitude, r.longitude, r.severity.value, r.status.value,
                r.damage_type or "", r.upvotes,
                r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "",
                r.fixed_at.strftime("%Y-%m-%d %H:%M") if getattr(r,"fixed_at",None) else "",
            ])
        out.seek(0)
        return StreamingResponse(
            iter([out.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=my-reports.csv"},
        )

    # ── PDF ──────────────────────────────────────────────
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=15*mm, rightMargin=15*mm,
                            topMargin=20*mm, bottomMargin=20*mm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("SadakSathi — My Road Reports", styles["Title"]))
    story.append(Paragraph(f"Reporter: {u.name} | Exported: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles["Normal"]))
    story.append(Spacer(1, 8*mm))

    headers = ["#","Title","Address","Severity","Status","Upvotes","Date"]
    rows = [headers]
    for r in reports:
        rows.append([
            str(r.id),
            (r.title[:35]+"…") if len(r.title)>35 else r.title,
            (r.address or "—")[:30],
            r.severity.value,
            r.status.value.replace("_"," "),
            str(r.upvotes),
            r.created_at.strftime("%Y-%m-%d") if r.created_at else "",
        ])

    col_widths = [10*mm, 60*mm, 45*mm, 20*mm, 25*mm, 15*mm, 25*mm]
    t = Table(rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), colors.HexColor("#DC2626")),
        ("TEXTCOLOR",   (0,0), (-1,0), colors.white),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,0), 9),
        ("FONTSIZE",    (0,1), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#fef2f2")]),
        ("GRID",        (0,0), (-1,-1), 0.4, colors.HexColor("#e5e7eb")),
        ("VALIGN",      (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 4),
        ("RIGHTPADDING",(0,0), (-1,-1), 4),
        ("TOPPADDING",  (0,0), (-1,-1), 3),
        ("BOTTOMPADDING",(0,0),(-1,-1), 3),
    ]))
    story.append(t)

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=my-reports.pdf"},
    )


# ══════════════════════════════════════════════════════════
# SOS CONTACTS
# ══════════════════════════════════════════════════════════

BUILT_IN_SOS = [
    {"name":"Nepal Police",       "name_ne":"नेपाल प्रहरी",         "number":"100",         "type":"emergency", "custom":False},
    {"name":"Traffic Police",     "name_ne":"ट्राफिक प्रहरी",       "number":"103",         "type":"traffic",   "custom":False},
    {"name":"KMC Helpline",       "name_ne":"काठमाडौं महानगर",      "number":"01-4220706",  "type":"municipal", "custom":False},
    {"name":"Road Dept (DoR)",    "name_ne":"सडक विभाग",            "number":"01-4211579",  "type":"roads",     "custom":False},
    {"name":"Ambulance",          "name_ne":"एम्बुलेन्स",            "number":"102",         "type":"emergency", "custom":False},
    {"name":"Fire Brigade",       "name_ne":"दमकल",                  "number":"101",         "type":"emergency", "custom":False},
    {"name":"Nepal Red Cross",    "name_ne":"नेपाल रेडक्रस",        "number":"01-4270650",  "type":"emergency", "custom":False},
]

@router.get("/sos-contacts")
def get_sos_contacts(u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    custom = db.query(CustomSosContact).filter(CustomSosContact.user_id == u.id).all()
    custom_list = [
        {"id": c.id, "name": c.name, "name_ne": "", "number": c.number,
         "type": "custom", "custom": True}
        for c in custom
    ]
    return BUILT_IN_SOS + custom_list

@router.post("/sos-contacts", status_code=201)
def add_sos_contact(req: SosContactIn, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = CustomSosContact(user_id=u.id, name=req.name.strip(), number=req.number.strip())
    db.add(contact); db.commit(); db.refresh(contact)
    return {"id": contact.id, "name": contact.name, "number": contact.number,
            "type": "custom", "custom": True}

@router.delete("/sos-contacts/{contact_id}", status_code=204)
def delete_sos_contact(contact_id: int, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = db.query(CustomSosContact).filter(
        CustomSosContact.id == contact_id,
        CustomSosContact.user_id == u.id
    ).first()
    if not c: raise HTTPException(404, "Contact not found")
    db.delete(c); db.commit()


# ══════════════════════════════════════════════════════════
# DELETE ACCOUNT
# ══════════════════════════════════════════════════════════

@router.delete("/account")
def delete_account(req: DeleteAccountReq, u: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(req.password, u.hashed_password):
        raise HTTPException(400, "Incorrect password")
    db.query(CustomSosContact).filter(CustomSosContact.user_id == u.id).delete()
    db.query(Notification).filter(Notification.user_id == u.id).delete()
    db.query(Report).filter(Report.reporter_id == u.id).delete()
    db.delete(u); db.commit()
    return {"message": "Account deleted successfully"}
