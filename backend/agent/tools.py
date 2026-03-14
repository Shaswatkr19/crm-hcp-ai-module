# backend/agent/tools.py
"""
LangGraph Agent Tools for CRM HCP Module.

Five tools:
  1. log_interaction     — Parse free text → structured record → save to DB
  2. edit_interaction    — Update an existing interaction by ID
  3. search_interactions — Query past interactions by HCP name / date range
  4. summarize_hcp       — LLM-generated narrative summary for a doctor
  5. recommend_actions   — Suggest next best actions / products for a doctor
"""

import json
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from langchain_core.tools import tool
from langchain_groq import ChatGroq
from sqlalchemy import select, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings

# ── LLM client (shared, lazy-loaded) ────────────────────────────────────────
_llm: Optional[ChatGroq] = None


def get_llm() -> ChatGroq:
    global _llm
    if _llm is None:
        _llm = ChatGroq(
            api_key=settings.GROQ_API_KEY,
            model_name=settings.LLM_MODEL,
            temperature=0.3,
            max_tokens=1024,
        )
    return _llm


# ── Helpers ──────────────────────────────────────────────────────────────────

def _today() -> str:
    return date.today().isoformat()


def _parse_json_from_llm(text: str) -> Dict:
    """Extract the first JSON block from LLM output."""
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass
    return {}


def _to_date(value: Optional[str]) -> Optional[date]:
    """
    Safely convert a string (YYYY-MM-DD or ISO format) to a Python date.
    Returns None if value is None, empty, or unparseable.
    """
    if not value:
        return None
    if isinstance(value, date):          # already a date object
        return value
    try:
        # handles "2025-01-15" and "2025-01-15T00:00:00"
        return datetime.fromisoformat(str(value).strip()).date()
    except (ValueError, TypeError):
        return None


# ═══════════════════════════════════════════════════════════════════════════
# TOOL 1 — Log Interaction  (unchanged — working correctly)
# ═══════════════════════════════════════════════════════════════════════════

async def log_interaction_tool(
    raw_text: str,
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Converts a free-text description of an HCP interaction into a structured
    record and persists it to the database.
    """
    from database import Interaction

    extraction_prompt = f"""
You are a CRM data extraction assistant for a pharmaceutical field rep.
Extract the following fields from the interaction note below.
Return ONLY valid JSON — no prose, no markdown fences.

Fields to extract:
  hcp_name         (string, required)
  hospital         (string or null)
  interaction_type (one of: Meeting | Call | Email | Conference | Other)
  interaction_date (ISO date YYYY-MM-DD; use today {_today()} if not mentioned)
  topics_discussed (string summarising key discussion points)
  sentiment        (one of: Positive | Neutral | Negative — infer from tone)
  outcomes         (string — key agreements or results)
  follow_up_actions (string — what needs to happen next)
  follow_up_date   (ISO date or null)
  materials_shared  (comma-separated list or null)
  samples_distributed (comma-separated list or null)

Interaction note:
\"\"\"{raw_text}\"\"\"

Return JSON only:
"""

    llm = get_llm()
    response = await llm.ainvoke(extraction_prompt)
    extracted = _parse_json_from_llm(response.content)

    if not extracted.get("hcp_name"):
        return {"success": False, "error": "Could not extract HCP name from input."}

    # Convert date strings → Python date objects
    interaction_date = _to_date(extracted.get("interaction_date") or _today())
    follow_up_date = _to_date(extracted.get("follow_up_date"))    

    interaction = Interaction(
        hcp_name=extracted.get("hcp_name", "Unknown"),
        hospital=extracted.get("hospital"),
        interaction_type=extracted.get("interaction_type", "Meeting"),
        interaction_date=interaction_date,
        topics_discussed=extracted.get("topics_discussed"),
        sentiment=extracted.get("sentiment", "Neutral"),
        outcomes=extracted.get("outcomes"),
        follow_up_actions=extracted.get("follow_up_actions"),
        follow_up_date=follow_up_date,
        materials_shared=extracted.get("materials_shared"),
        samples_distributed=extracted.get("samples_distributed"),
        source="chat",
        raw_input=raw_text,
        ai_summary=extracted.get("topics_discussed"),
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)

    return {
        "success": True,
        "action": "log_interaction",
        "interaction_id": interaction.id,
        "hcp_name": interaction.hcp_name,
        "interaction_type": interaction.interaction_type,
        "interaction_date": str(interaction.interaction_date),
        "sentiment": interaction.sentiment,
        "topics_discussed": interaction.topics_discussed,
        "follow_up_actions": interaction.follow_up_actions,
        "message": f"Interaction with {interaction.hcp_name} logged successfully (ID: {interaction.id}).",
    }


# ═══════════════════════════════════════════════════════════════════════════
# TOOL 2 — Edit Interaction  (unchanged — working correctly)
# ═══════════════════════════════════════════════════════════════════════════

async def edit_interaction_tool(
    interaction_id: int,
    updates: Dict[str, Any],
    db: AsyncSession,
) -> Dict[str, Any]:
    """Modifies an existing interaction record."""
    from database import Interaction

    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id)
    )
    interaction = result.scalar_one_or_none()

    if not interaction:
        return {"success": False, "error": f"Interaction ID {interaction_id} not found."}

    allowed_fields = {
        "hcp_name", "hospital", "interaction_type", "interaction_date",
        "topics_discussed", "sentiment", "outcomes", "follow_up_actions",
        "follow_up_date", "materials_shared", "samples_distributed", "attendees",
    }

    clean_updates = {
        k: v for k, v in updates.items()
        if k in allowed_fields and v is not None
    }

    if not clean_updates:
        return {"success": False, "error": "No valid fields to update."}

    for field, value in clean_updates.items():
        setattr(interaction, field, value)

    await db.commit()
    await db.refresh(interaction)

    return {
        "success": True,
        "action": "edit_interaction",
        "interaction_id": interaction.id,
        "updated_fields": list(clean_updates.keys()),
        "message": f"Interaction ID {interaction_id} updated successfully.",
    }


# ═══════════════════════════════════════════════════════════════════════════
# TOOL 3 — Search Interactions
# BUG FIX: from_date / to_date were passed as raw strings to SQLAlchemy.
# PostgreSQL cannot compare a DATE column against a VARCHAR — throws:
#   "operator does not exist: date >= character varying"
# Fix: convert strings to Python date objects via _to_date() before filtering.
# ═══════════════════════════════════════════════════════════════════════════

async def search_interactions_tool(
    hcp_name: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 10,
    db: AsyncSession = None,
) -> Dict[str, Any]:
    """
    Retrieves past interactions filtered by HCP name and/or date range.
    """
    from database import Interaction
    from sqlalchemy import and_

    # ── FIX: convert string dates → Python date objects ──────────────────
    from_date_obj: Optional[date] = _to_date(from_date)
    to_date_obj:   Optional[date] = _to_date(to_date)

    # warn if a date string was provided but couldn't be parsed
    parse_warnings = []
    if from_date and from_date_obj is None:
        parse_warnings.append(f"Could not parse from_date '{from_date}' — ignored.")
    if to_date and to_date_obj is None:
        parse_warnings.append(f"Could not parse to_date '{to_date}' — ignored.")
    # ─────────────────────────────────────────────────────────────────────

    query = select(Interaction).order_by(Interaction.interaction_date.desc())

    filters = []
    if hcp_name:
        filters.append(Interaction.hcp_name.ilike(f"%{hcp_name}%"))
    if from_date_obj:                                      # ← date object now
        filters.append(Interaction.interaction_date >= from_date_obj)
    if to_date_obj:                                        # ← date object now
        filters.append(Interaction.interaction_date <= to_date_obj)

    if filters:
        query = query.where(and_(*filters))

    query = query.limit(limit)
    result = await db.execute(query)
    rows = result.scalars().all()

    interactions = [
        {
            "id":               r.id,
            "hcp_name":         r.hcp_name,
            "hospital":         r.hospital,
            "interaction_type": r.interaction_type,
            "interaction_date": str(r.interaction_date),
            "sentiment":        r.sentiment,
            "topics_discussed": r.topics_discussed,
            "follow_up_actions":r.follow_up_actions,
            "source":           r.source,
        }
        for r in rows
    ]

    message = f"Found {len(interactions)} interaction(s)"
    if hcp_name:
        message += f" for {hcp_name}"
    if from_date_obj or to_date_obj:
        message += f" (date range: {from_date_obj or 'any'} → {to_date_obj or 'any'})"
    message += "."

    if parse_warnings:
        message += " Note: " + " ".join(parse_warnings)

    return {
        "success":      True,
        "action":       "search_interactions",
        "count":        len(interactions),
        "interactions": interactions,
        "message":      message,
    }


# ═══════════════════════════════════════════════════════════════════════════
# TOOL 4 — Summarize HCP Interactions
# BUG FIX 1: No try/except around LLM call — any Groq error returned
#             "Unknown error" to the user with no context.
# BUG FIX 2: Empty result returned success:False with only a "message" key
#             but the graph's format_response node expected "error" key,
#             causing a KeyError → "Unknown error".
# Fix: wrap LLM call in try/except, always return consistent keys.
# ═══════════════════════════════════════════════════════════════════════════

async def summarize_hcp_tool(
    hcp_name: str,
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Pulls all interactions for a given HCP and asks the LLM to produce a
    concise narrative summary.
    """
    from database import Interaction

    # ── Guard: empty hcp_name ─────────────────────────────────────────────
    if not hcp_name or not hcp_name.strip():
        return {
            "success": False,
            "error":   "HCP name is required for summarization.",
        }

    result = await db.execute(
        select(Interaction)
        .where(Interaction.hcp_name.ilike(f"%{hcp_name.strip()}%"))
        .order_by(Interaction.interaction_date.asc())
    )
    rows = result.scalars().all()

    # ── FIX 1: Empty results — return gracefully instead of success:False ─
    if not rows:
        return {
            "success": True,
            "action":  "summarize_hcp",
            "hcp_name": hcp_name,
            "total_interactions": 0,
            "summary": (
                f"No interaction history found for {hcp_name}. "
                "Log your first meeting to start building a relationship profile."
            ),
            "message": f"No interactions found for {hcp_name}.",
        }

    # Build compact context for the LLM
    history_text = "\n".join([
        f"[{r.interaction_date}] {r.interaction_type} — "
        f"Topics: {r.topics_discussed or 'N/A'} | "
        f"Sentiment: {r.sentiment} | "
        f"Outcomes: {r.outcomes or 'N/A'} | "
        f"Follow-up: {r.follow_up_actions or 'N/A'}"
        for r in rows
    ])

    summary_prompt = f"""
You are a pharma field rep assistant. Summarize the following interaction history
with {hcp_name} in 3–5 concise bullet points. Focus on key themes, relationship
status, pending actions, and product interest signals.

History:
{history_text}

Return plain text bullets only.
"""

    # ── FIX 2: Wrap LLM call in try/except ───────────────────────────────
    try:
        llm = get_llm()
        response = await llm.ainvoke(summary_prompt)
        summary = response.content.strip()
        if not summary:
            summary = "Summary could not be generated — LLM returned empty response."
    except Exception as e:
        return {
            "success": False,
            "error":   f"LLM error during summarization: {str(e)}",
        }
    # ─────────────────────────────────────────────────────────────────────

    return {
        "success":            True,
        "action":             "summarize_hcp",
        "hcp_name":           hcp_name,
        "total_interactions": len(rows),
        "summary":            summary,
        "message":            f"Summary generated for {hcp_name} ({len(rows)} interaction(s)).",
    }


# ═══════════════════════════════════════════════════════════════════════════
# TOOL 5 — Recommend Next Actions
# IMPROVEMENT: When no interaction history exists, return specific first-visit
#              action list instead of a generic single-line message.
# ═══════════════════════════════════════════════════════════════════════════

# Default first-visit recommendations when no history exists
_FIRST_VISIT_RECOMMENDATIONS = [
    "Schedule an introductory visit — confirm preferred meeting time via phone or email.",
    "Research the doctor's specialty and prepare a tailored product overview relevant to their patient base.",
    "Bring printed clinical study summaries and key product brochures for the first meeting.",
    "Prepare a sample kit with the most relevant products for their specialty.",
    "Keep the first visit brief (15–20 min) — focus on introducing yourself and understanding their current prescribing habits.",
]

async def recommend_actions_tool(
    hcp_name: str,
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Analyses the interaction history of an HCP and recommends next best actions.
    """
    from database import Interaction

    # ── Guard: empty hcp_name ─────────────────────────────────────────────
    if not hcp_name or not hcp_name.strip():
        return {
            "success": False,
            "error":   "HCP name is required for recommendations.",
        }

    result = await db.execute(
        select(Interaction)
        .where(Interaction.hcp_name.ilike(f"%{hcp_name.strip()}%"))
        .order_by(Interaction.interaction_date.desc())
        .limit(5)
    )
    rows = result.scalars().all()

    # ── IMPROVEMENT: No history → specific first-visit list ───────────────
    if not rows:
        return {
            "success":         True,
            "action":          "recommend_actions",
            "hcp_name":        hcp_name,
            "recommendations": _FIRST_VISIT_RECOMMENDATIONS,
            "message":         (
                f"No prior interactions found for {hcp_name}. "
                "Here are recommended first-visit actions:"
            ),
        }
    # ─────────────────────────────────────────────────────────────────────

    history_text = "\n".join([
        f"Date: {r.interaction_date} | Type: {r.interaction_type} | "
        f"Topics: {r.topics_discussed or 'N/A'} | Sentiment: {r.sentiment} | "
        f"Outcomes: {r.outcomes or 'N/A'} | Pending: {r.follow_up_actions or 'None'}"
        for r in rows
    ])

    recommendation_prompt = f"""
You are a senior pharma sales coach. Based on the recent interaction history
below for Dr. {hcp_name}, provide 3–5 specific, actionable recommendations for
the next field visit. Consider pending follow-ups, sentiment trends, and potential
product interest. Be concise and practical.

Recent Interactions:
{history_text}

Return a numbered list of recommendations only.
"""

    try:
        llm = get_llm()
        response = await llm.ainvoke(recommendation_prompt)
        raw = response.content.strip()
    except Exception as e:
        return {
            "success": False,
            "error":   f"LLM error during recommendation: {str(e)}",
        }

    # Parse "1. foo\n2. bar" → ["foo", "bar"]
    lines = [
        re.sub(r"^\d+[\.\)]\s*", "", l.strip())   # strip leading "1. " or "1) "
        for l in raw.split("\n")
        if l.strip() and l.strip()[0].isdigit()
    ]

    # Fallback: if LLM didn't number its output, return the whole text as one item
    recommendations = lines if lines else [raw]

    return {
        "success":         True,
        "action":          "recommend_actions",
        "hcp_name":        hcp_name,
        "recommendations": recommendations,
        "message":         f"Generated {len(recommendations)} recommendation(s) for {hcp_name}.",
    }