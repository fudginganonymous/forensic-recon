"""
Application configuration.
Reads from environment variables with sensible defaults for local dev.
Switching DATABASE_URL to a postgres:// connection string upgrades the
storage layer with no other code changes (SQLAlchemy handles the dialect).
"""
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    # --- General ---
    APP_NAME: str = "Forensic Reconstruction Decision-Support System"
    ENV: str = "development"

    # --- Database ---
    # SQLite for local research deployment. To upgrade:
    # DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/dbname
    DATABASE_URL: str = "sqlite:///./forensic_recon.db"

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalise_database_url(cls, v: str) -> str:
        """
        Render (and some other providers) supply DATABASE_URL as
        'postgres://...' or 'postgresql://...'. SQLAlchemy with the
        psycopg2 driver expects 'postgresql+psycopg2://...'. Rewrite
        automatically so no manual env var surgery is needed.
        """
        if v.startswith("postgres://"):
            return "postgresql+psycopg2://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            return "postgresql+psycopg2://" + v[len("postgresql://"):]
        return v

    # --- Auth ---
    SECRET_KEY: str = Field(
        default="CHANGE_THIS_SECRET_KEY_IN_PRODUCTION_ENV_FILE",
        description="Used to sign JWT tokens. MUST be overridden in production via .env",
    )
    ALGORITHM: str = "HS256"
    # 12 hours, suitable for exercise sessions
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12

    # --- CORS ---
    FRONTEND_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    # --- File uploads (evidence files) ---
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 25

    class Config:
        env_file = ".env"


settings = Settings()
