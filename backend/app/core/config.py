"""
Application configuration.
Reads from environment variables with sensible defaults for local dev.
Switching DATABASE_URL to a postgres:// connection string upgrades the
storage layer with no other code changes (SQLAlchemy handles the dialect).
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    # --- General ---
    APP_NAME: str = "Forensic Reconstruction Decision-Support System"
    ENV: str = "development"

    # --- Database ---
    # SQLite for local research deployment. To upgrade:
    # DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/dbname
    DATABASE_URL: str = "sqlite:///./forensic_recon.db"

    @field_validator("DATABASE_URL")
    def validate_db_url(cls, v):
        # Prevent accidental use of deprecated postgres:// scheme
        if v.startswith("postgres://"):
            raise ValueError("Use postgresql+psycopg2:// for SQLAlchemy")
        return v

    # --- Cloudinary ---
    # These are optional. If provided, Cloudinary will be used for file storage.
    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None

    # --- Local fallback storage ---
    # Used only when Cloudinary credentials are not provided.
    UPLOAD_DIR: str = "./uploads"

    class Config:
        # Allows loading environment variables from a .env file locally
        env_file = ".env"


settings = Settings()
