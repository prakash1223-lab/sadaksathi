import os
from pydantic_settings import BaseSettings

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_FILE    = os.path.join(_BACKEND_DIR, ".env")

# Use /tmp on Railway (read-only filesystem), local path otherwise
_IS_RAILWAY = os.environ.get("RAILWAY_ENVIRONMENT") is not None
_DEFAULT_DB  = "sqlite:///./sadaksathi.db" if _IS_RAILWAY else f"sqlite:///{os.path.join(_BACKEND_DIR, 'sadaksathi.db')}"
_DEFAULT_UPLOAD = "/tmp/uploads" if _IS_RAILWAY else os.path.join(_BACKEND_DIR, "uploads")


class Settings(BaseSettings):
    DATABASE_URL: str = _DEFAULT_DB
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    UPLOAD_DIR: str = _DEFAULT_UPLOAD
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    # Cloudinary — set all three in Railway env vars to enable cloud storage
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    model_config = {"env_file": _ENV_FILE, "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def use_cloudinary(self) -> bool:
        return bool(self.CLOUDINARY_CLOUD_NAME and self.CLOUDINARY_API_KEY and self.CLOUDINARY_API_SECRET)

    @property
    def gemini_key(self) -> str:
        """Always read from live env var first, then .env file value."""
        live = os.environ.get("GEMINI_API_KEY", "").strip()
        if live:
            return live
        # Re-read .env file directly in case it changed after startup
        try:
            with open(_ENV_FILE) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GEMINI_API_KEY="):
                        return line.split("=", 1)[1].strip()
        except Exception:
            pass
        return self.GEMINI_API_KEY


settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
