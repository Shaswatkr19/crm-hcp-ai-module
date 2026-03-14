# backend/routes/interactions.py
"""
REST endpoints for direct CRUD operations on interactions.
These are used by the structured FORM-based UI.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, Interaction, HCP
from schemas import (
    InteractionCreate, InteractionOut, InteractionUpdate,
    HCPOut, HCPCreate,
)

router = APIRouter(prefix="/interactions", tags=["Interactions"])


# ── HCPs ──────────────────────────────────────────────────────────────────────

@router.delete("/hcps/{hcp_id}")
async def delete_hcp(hcp_id: int, db: AsyncSession = Depends(get_db)):
    from database import HCP

    result = await db.execute(
        select(HCP).where(HCP.id == hcp_id)
    )
    hcp = result.scalar_one_or_none()

    if not hcp:
        raise HTTPException(status_code=404, detail="HCP not found")

    await db.delete(hcp)
    await db.commit()

    return {"message": "HCP deleted successfully"}

@router.get("/hcps", response_model=List[HCPOut])
async def list_hcps(
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List all HCPs, optionally filtered by name search."""
    query = select(HCP).order_by(HCP.name)
    if search:
        query = query.where(HCP.name.ilike(f"%{search}%"))
    result = await db.execute(query)
    return result.scalars().all()


# ── FEATURE 3: Create HCP ─────────────────────────────────────────────────────

@router.post("/hcps", response_model=HCPOut, status_code=201)
async def create_hcp(
    payload: HCPCreate,
    db: AsyncSession = Depends(get_db),
):
    """Add a new HCP (doctor) to the directory."""
    hcp = HCP(**payload.model_dump())
    db.add(hcp)
    await db.commit()
    await db.refresh(hcp)
    return hcp


# ── Interactions ──────────────────────────────────────────────────────────────

@router.post("/", response_model=InteractionOut, status_code=201)
async def create_interaction(
    payload: InteractionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new interaction via the structured form."""
    interaction = Interaction(**payload.model_dump())
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)
    return interaction


@router.get("/", response_model=List[InteractionOut])
async def list_interactions(
    hcp_name: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """List interactions with optional filters."""
    from sqlalchemy import and_

    query = select(Interaction).order_by(Interaction.interaction_date.desc())
    filters = []

    if hcp_name:
        filters.append(Interaction.hcp_name.ilike(f"%{hcp_name}%"))
    if from_date:
        filters.append(Interaction.interaction_date >= from_date)
    if to_date:
        filters.append(Interaction.interaction_date <= to_date)

    if filters:
        query = query.where(and_(*filters))

    result = await db.execute(query.limit(limit))
    return result.scalars().all()


@router.get("/{interaction_id}", response_model=InteractionOut)
async def get_interaction(
    interaction_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return row


@router.patch("/{interaction_id}", response_model=InteractionOut)
async def update_interaction(
    interaction_id: int,
    payload: InteractionUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Interaction not found")

    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(row, field, value)

    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{interaction_id}", status_code=204)
async def delete_interaction(
    interaction_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Interaction not found")

    await db.delete(row)
    await db.commit()
