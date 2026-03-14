# backend/main.py
"""
CRM HCP Module — FastAPI Application Entry Point

Run with:
    uvicorn main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import create_tables
from routes.interactions import router as interactions_router
from routes.agent_routes import router as agent_router


# ── Lifespan (startup/shutdown) ───────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create DB tables if they don't exist
    await create_tables()
    print("✅  Database tables ready")
    yield
    # Shutdown: nothing to clean up for now
    print("👋  Server shutting down")


# ── App Instance ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="CRM HCP Module API",
    description="AI-First CRM for Pharma Field Representatives",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(interactions_router)
app.include_router(agent_router)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "service": "CRM HCP API", "version": "1.0.0"}


@app.get("/", tags=["System"])
async def root():
    return {
        "message": "CRM HCP Module API",
        "docs": "/docs",
        "health": "/health",
    }
