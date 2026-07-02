from fastapi import APIRouter, UploadFile, File, HTTPException
import aiofiles, os, uuid
from core.config import settings

router = APIRouter(prefix="/ai", tags=["ai"])

def _get_api_key() -> str:
    """
    Read GEMINI_API_KEY fresh each request — checks env var first,
    then falls back to settings (which was loaded at startup).
    This ensures a server restart isn't needed after .env changes.
    """
    # 1. Live environment variable (set by Railway / system)
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key
    # 2. Loaded from .env at startup
    return (settings.GEMINI_API_KEY or "").strip()


@router.post("/analyze")
async def analyze_photo(photo: UploadFile = File(...)):
    """
    Public endpoint — accepts a photo and returns Gemini Vision classification.
    No login required so the frontend can call before the user submits.
    """
    if not photo.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext      = os.path.splitext(photo.filename)[1] or ".jpg"
    filename = f"tmp_{uuid.uuid4()}{ext}"
    path     = os.path.join(settings.UPLOAD_DIR, filename)

    try:
        async with aiofiles.open(path, "wb") as f:
            await f.write(await photo.read())

        # Always inject the freshest key into the environment before calling classifier
        api_key = _get_api_key()
        if not api_key:
            api_key = settings.gemini_key
        os.environ["GEMINI_API_KEY"] = api_key

        from ai.classifier import analyze_road_image
        result = analyze_road_image(path)
        return result

    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    finally:
        try:
            os.remove(path)
        except OSError:
            pass
