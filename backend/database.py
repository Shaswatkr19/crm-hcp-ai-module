# backend/database.py
"""
Async SQLAlchemy setup for PostgreSQL.
All ORM models are defined here.
"""

from datetime import date, time, datetime
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, Text, Date, Time,
    DateTime, ForeignKey, func
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship

from config import settings

# ---------------------------------------------------------------------------
# Engine & Session Factory
# ---------------------------------------------------------------------------

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    """FastAPI dependency — yields a DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_tables():
    """Create all tables on startup (dev convenience)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# ---------------------------------------------------------------------------
# ORM Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class HCP(Base):
    __tablename__ = "hcps"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String(255), nullable=False, index=True)
    specialty  = Column(String(255))
    hospital   = Column(String(255))
    city       = Column(String(100))
    email      = Column(String(255))
    phone      = Column(String(50))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    interactions = relationship("Interaction", back_populates="hcp")


class Interaction(Base):
    __tablename__ = "interactions"

    id                  = Column(Integer, primary_key=True, index=True)
    hcp_id              = Column(Integer, ForeignKey("hcps.id"), nullable=True)
    hcp_name            = Column(String(255), nullable=False, index=True)
    hospital            = Column(String(255))
    interaction_type    = Column(String(100), default="Meeting")
    interaction_date    = Column(Date, nullable=False)
    interaction_time    = Column(Time)
    attendees           = Column(Text)
    topics_discussed    = Column(Text)
    materials_shared    = Column(Text)       # JSON string
    samples_distributed = Column(Text)       # JSON string
    sentiment           = Column(String(50), default="Neutral")
    outcomes            = Column(Text)
    follow_up_actions   = Column(Text)
    follow_up_date      = Column(Date)
    ai_summary          = Column(Text)
    source              = Column(String(50), default="form")
    raw_input           = Column(Text)
    created_at          = Column(DateTime, server_default=func.now())
    updated_at          = Column(DateTime, server_default=func.now(), onupdate=func.now())

    hcp             = relationship("HCP", back_populates="interactions")
    ai_suggestions  = relationship("AISuggestion", back_populates="interaction",
                                   cascade="all, delete-orphan")


class AISuggestion(Base):
    __tablename__ = "ai_suggestions"

    id              = Column(Integer, primary_key=True, index=True)
    interaction_id  = Column(Integer, ForeignKey("interactions.id"), nullable=True)
    hcp_name        = Column(String(255))
    suggestion_type = Column(String(100))
    suggestion_text = Column(Text)
    created_at      = Column(DateTime, server_default=func.now())

    interaction = relationship("Interaction", back_populates="ai_suggestions")
