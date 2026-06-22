"""
Database engine and session management.

For SQLite, `check_same_thread=False` is required because FastAPI may
serve requests from different threads. This setting is ignored by
PostgreSQL/MySQL drivers, so no change is needed when upgrading.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    FastAPI dependency that provides a database session per-request
    and guarantees it is closed afterwards.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
