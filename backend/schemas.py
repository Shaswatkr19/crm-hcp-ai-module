# backend/schemas.py
"""
Pydantic v2 schemas for request validation and API response serialization.
"""

from datetime import date, time, datetime
from typing import Any, Optional, List
from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# HCP Schemas
# ---------------------------------------------------------------------------

class HCPBase(BaseModel):
    name: str
    specialty: Optional[str] = None
    hospital: Optional[str] = None
    city: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class HCPCreate(HCPBase):
    pass


class HCPOut(HCPBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Interaction Schemas
# ---------------------------------------------------------------------------

class InteractionBase(BaseModel):
    hcp_name: str
    hospital: Optional[str] = None
    interaction_type: Optional[str] = "Meeting"
    interaction_date: date
    interaction_time: Optional[time] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: Optional[str] = "Neutral"
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None
    follow_up_date: Optional[date] = None
    source: Optional[str] = "form"
    raw_input: Optional[str] = None


class InteractionCreate(InteractionBase):
    pass


class InteractionUpdate(BaseModel):
    """All fields optional for PATCH-style updates."""
    hcp_name: Optional[str] = None
    hospital: Optional[str] = None
    interaction_type: Optional[str] = None
    interaction_date: Optional[date] = None
    interaction_time: Optional[time] = None
    attendees: Optional[str] = None
    topics_discussed: Optional[str] = None
    materials_shared: Optional[str] = None
    samples_distributed: Optional[str] = None
    sentiment: Optional[str] = None
    outcomes: Optional[str] = None
    follow_up_actions: Optional[str] = None
    follow_up_date: Optional[date] = None


class InteractionOut(InteractionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ai_summary: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# AI / Chat Schemas
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    message: str
    hcp_name: Optional[str] = None          # optional pre-fill
    # Conversation context — sent by frontend on every message
    current_hcp: Optional[str] = None       # last mentioned doctor
    last_interaction_id: Optional[int] = None  # last logged/edited interaction


class AgentResponse(BaseModel):
    reply: str
    action: Optional[str] = None                    # which tool was invoked
    interaction: Optional[InteractionOut] = None    # log_interaction result
    suggestions: Optional[List[str]] = None         # recommend_actions result
    results: Optional[List[Any]] = None             # search_interactions result
    interactions: Optional[List[InteractionOut]] = None  # legacy field
    # Updated context — frontend saves these for next message
    current_hcp: Optional[str] = None
    last_interaction_id: Optional[int] = None


class AISuggestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    interaction_id: Optional[int] = None
    hcp_name: Optional[str] = None
    suggestion_type: Optional[str] = None
    suggestion_text: Optional[str] = None
    created_at: Optional[datetime] = None


class ExtractMessage(BaseModel):
    """Sent by frontend AI sidebar to extract/update form fields."""
    message: str
    # Current form state — so AI can apply corrections on top
    current_fields: Optional[Any] = None

class ExtractResponse(BaseModel):
    """AI reply + extracted/updated fields — form is NOT saved yet."""
    reply: str                          # conversational AI message
    fields: Optional[Any] = None        # filled form fields dict
    ask_followup: Optional[str] = None  # follow-up question AI wants to ask
    ready_to_submit: bool = False       # True if user said "submit"
