import os
from pydantic_settings import BaseSettings

# Always resolve paths relative to the backend/ directory, regardless of cwd
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_ENV_FILE    = os.path.join(_BACKEND_DIR, ".env")
_DB_PATH     = os.path.join(_BACKEND_DIR, "sadaksathi.db")
_UPLOAD_DIR  = os.path.join(_BACKEND_DIR, "uploads")

class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite:///{_DB_PATH}"
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    UPLOAD_DIR: str = _UPLOAD_DIR
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    model_config = {"env_file": _ENV_FILE, "env_file_encoding": "utf-8"}

settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
