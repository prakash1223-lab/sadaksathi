from fastapi import APIRouter, UploadFile, File, HTTPException
import aiofiles, os, uuid
from core.config import settings

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/analyze")
async def analyze_photo(photo: UploadFile = File(...)):
    """
    Public endpoint — accepts a photo and returns Claude Vision classification.
    No login required so the frontend can call before the user submits.
    """
    if not photo.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
        raise HTTPException(
            status_code=503,
            detail="AI service not configured. Set GEMINI_API_KEY in backend/.env",
        )

    ext      = os.path.splitext(photo.filename)[1] or ".jpg"
    filename = f"tmp_{uuid.uuid4()}{ext}"
    path     = os.path.join(settings.UPLOAD_DIR, filename)

    try:
        async with aiofiles.open(path, "wb") as f:
            await f.write(await photo.read())

        # Pass key via env var
        os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

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
