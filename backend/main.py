from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Nepal timezone
os.environ.setdefault('TZ', 'Asia/Kathmandu')

from core.database import engine, Base
from core.config import settings
import models  # registers all models with Base

app = FastAPI(
    title="SadakSathi API",
    description="Road Quality Reporting System for Nepal 🇳🇵",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "https://sadaksathi.vercel.app",
        "https://*.vercel.app",
        "https://sadaksathi-production.up.railway.app",
        "https://sadaksathi-production-8abd.up.railway.app",
        "https://sadaksathi-v1k9-three.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded photos as static files
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

from routes.auth import router as auth_router
from routes.reports import router as reports_router
from routes.users import router as users_router
from routes.ai import router as ai_router
from routes.admin import router as admin_router
from routes.notifications import router as notif_router
from routes.settings import router as settings_router

app.include_router(auth_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(ai_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(notif_router, prefix="/api")
app.include_router(settings_router, prefix="/api")


@app.on_event("startup")
async def startup():
    """Create DB tables and print startup info."""
    try:
        Base.metadata.create_all(bind=engine)
        print("=" * 50)
        print("🛣️  SadakSathi API started!")
        db_display = settings.DATABASE_URL[:30] + "..." if len(settings.DATABASE_URL) > 30 else settings.DATABASE_URL
        print(f"   Database: {db_display}")
        print(f"   Upload dir: {settings.UPLOAD_DIR}")
        print("   Database tables: OK")
        print("=" * 50)
    except Exception as e:
        print(f"❌ STARTUP ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise


@app.get("/", tags=["root"])
def root():
    return {
        "app": "SadakSathi API",
        "version": "1.0.0",
        "message": "Road Quality Reporting System for Nepal 🇳🇵",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["health"])
def health():
    return {
        "status": "healthy",
        "app": "SadakSathi API",
        "version": "1.0.0",
    }


@app.post("/api/setup-admin", tags=["setup"])
def setup_admin(secret: str = "sadaksathi-setup-2024"):
    """One-time endpoint to promote first user to admin. Remove after use."""
    if secret != "sadaksathi-setup-2024":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Wrong secret")
    from core.database import SessionLocal
    from models.user import User
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.phone == "9800000000").first()
        if not user:
            return {"error": "User 9800000000 not found"}
        user.is_admin = True
        db.commit()
        return {"ok": True, "message": f"User {user.name} ({user.phone}) is now admin"}
    finally:
        db.close()


@app.get("/api/stats", tags=["public"])
def get_stats():
    """Public stats for landing page."""
    from core.database import SessionLocal
    from models.report import Report, StatusEnum
    from models.user import User
    db = SessionLocal()
    try:
        total   = db.query(Report).count()
        fixed   = db.query(Report).filter(Report.status == StatusEnum.fixed).count()
        pending = db.query(Report).filter(Report.status == StatusEnum.pending).count()
        users   = db.query(User).count()
        return {
            "total_reports": total,
            "active_users": users,
            "fixed_roads": fixed,
            "pending_reports": pending,
        }
    finally:
        db.close()
