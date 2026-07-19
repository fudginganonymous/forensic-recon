"""
FastAPI application entrypoint.

Run with: uvicorn app.main:app --reload --port 8000

On startup, creates all database tables if they do not yet exist
(suitable for the SQLite research prototype; for PostgreSQL in
production, prefer Alembic migrations - see /alembic).
"""
from fastapi.staticfiles import StaticFiles
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import engine, Base
from app.models import *  # noqa: F401,F403 - ensures all models are registered with Base
from app.routers import auth, cases, sessions, bayesian, researcher

app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "API for a structured digital crime scene reconstruction workflow, "
        "with automated capture of hypothesis flexibility, premature closure, "
        "and confidence calibration metrics. Includes an optional, fully "
        "independent Bayesian reasoning module."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Serve uploaded evidence files as static assets
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR),
              name="uploads")
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


app.include_router(auth.router)
app.include_router(cases.router)
app.include_router(sessions.router)
app.include_router(bayesian.router)
app.include_router(researcher.router)


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "docs": "/docs",
    }
