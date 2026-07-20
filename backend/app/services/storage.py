"""
File storage service.
Uses Cloudinary when credentials are configured (production/Render),
falls back to local disk storage for local development.
"""
import os
import cloudinary
import cloudinary.uploader
from app.core.config import settings


def _cloudinary_configured() -> bool:
    return bool(
        settings.CLOUDINARY_CLOUD_NAME
        and settings.CLOUDINARY_API_KEY
        and settings.CLOUDINARY_API_SECRET
    )


def configure_cloudinary():
    if _cloudinary_configured():
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )


def save_upload(file_obj, filename: str, case_id: int) -> str:
    """
    Save an uploaded file. Returns a URL string.
    - On Render (Cloudinary configured): uploads to Cloudinary, returns CDN URL.
    - Locally (no Cloudinary): saves to disk, returns local path.
    """
    configure_cloudinary()

    if _cloudinary_configured():
        result = cloudinary.uploader.upload(
            file_obj,
            folder=f"forensic-recon/case_{case_id}",
            resource_type="auto",
            use_filename=True,
            unique_filename=True,
        )
        return result["secure_url"]   # e.g. https://res.cloudinary.com/...
    else:
        # Local fallback
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        case_dir = os.path.join(settings.UPLOAD_DIR, f"case_{case_id}")
        os.makedirs(case_dir, exist_ok=True)
        dest = os.path.join(case_dir, filename)
        with open(dest, "wb") as f:
            import shutil
            shutil.copyfileobj(file_obj, f)
        return dest
