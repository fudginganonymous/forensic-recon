"""
FastAPI application entrypoint.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db.session import engine, Base
from app.models import *  # noqa: F401,F403
from app.routers import auth, cases, sessions, bayesian, researcher

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "API for a structured digital crime scene reconstruction workflow."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    # Ensure uploads directory exists
   # os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(sessions.router)
app.include_router(bayesian.router)
app.include_router(researcher.router)


# ── Static file serving — MUST come after routers ────────────────────────────
# Mounted last so it does not intercept API routes.
# Files are served publicly (no auth) so participants can view evidence images.
# _upload_dir = os.path.abspath(settings.UPLOAD_DIR)
# os.makedirs(_upload_dir, exist_ok=True)
# app.mount("/uploads", StaticFiles(directory=_upload_dir), name="uploads")


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "docs": "/docs",
    }
