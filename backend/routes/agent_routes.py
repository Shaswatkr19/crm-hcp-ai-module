# backend/routes/agent_routes.py
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, Interaction
from schemas import ChatMessage, AgentResponse, InteractionOut, ExtractMessage
from agent.graph import run_agent
from sqlalchemy import select

router = APIRouter(prefix="/agent", tags=["AI Agent"])


@router.post("/chat", response_model=AgentResponse)
async def agent_chat(
    payload: ChatMessage,
    db: AsyncSession = Depends(get_db),
):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    result = await run_agent(
        user_message=payload.message,
        db=db,
        current_hcp=payload.current_hcp,
        last_interaction_id=payload.last_interaction_id,
    )

    action      = result.get("action", "")
    tool_result = result.get("tool_result", {})

    interaction_out = None
    if action == "log_interaction" and tool_result.get("success"):
        iid = tool_result.get("interaction_id")
        if iid:
            res = await db.execute(select(Interaction).where(Interaction.id == iid))
            row = res.scalar_one_or_none()
            if row:
                interaction_out = InteractionOut.model_validate(row)

    suggestions: Optional[List[str]] = None
    if action == "recommend_actions" and tool_result.get("success"):
        recs = tool_result.get("recommendations", [])
        suggestions = recs if recs else None

    results_out: Optional[List[Dict[str, Any]]] = None
    if action == "search_interactions" and tool_result.get("success"):
        ints = tool_result.get("interactions", [])
        results_out = ints if ints else None

    return AgentResponse(
        reply=result["reply"],
        action=action,
        interaction=interaction_out,
        suggestions=suggestions,
        results=results_out,
        current_hcp=result.get("current_hcp"),
        last_interaction_id=result.get("last_interaction_id"),
    )


@router.post("/tool/log", response_model=AgentResponse)
async def direct_log(
    payload: ChatMessage,
    db: AsyncSession = Depends(get_db),
):
    from agent.tools import log_interaction_tool
    result = await log_interaction_tool(raw_text=payload.message, db=db)

    interaction_out = None
    if result.get("success") and result.get("interaction_id"):
        res = await db.execute(
            select(Interaction).where(Interaction.id == result["interaction_id"])
        )
        row = res.scalar_one_or_none()
        if row:
            interaction_out = InteractionOut.model_validate(row)

    return AgentResponse(
        reply=result.get("message", "Interaction logged."),
        action="log_interaction",
        interaction=interaction_out,
        current_hcp=result.get("hcp_name"),
        last_interaction_id=result.get("interaction_id"),
    )


@router.post("/extract")
async def extract_fields(payload: ExtractMessage):
    """
    Extract/update form fields from natural language WITHOUT saving to DB.
    Supports: initial fill, corrections, partial updates.
    Returns filled fields + conversational AI reply.
    """
    from agent.tools import get_llm, _parse_json_from_llm
    import datetime

    llm   = get_llm()
    today = datetime.date.today().isoformat()
    msg   = payload.message.strip()

    # Detect submit intent
    submit_keywords = [
        "submit", "save it", "log it", "confirm", "yes submit",
        "go ahead", "save this", "looks good submit", "submit now",
        "that's correct", "correct submit", "yes log it",
    ]
    wants_submit = any(k in msg.lower() for k in submit_keywords)

    # Build context from current form fields
    prev = ""
    if payload.current_fields:
        cf = payload.current_fields
        lines = [f"  {k}: {v}" for k, v in cf.items() if v and v not in ("form", "chat", "Neutral", "Meeting")]
        if lines:
            prev = "Currently filled fields:\n" + "\n".join(lines)

    # Detect message type for better prompt instructions
    additive_keywords   = ["i also", "also distributed", "also shared", "additionally", "we also", "and also", "outcome was", "outcomes:", "result was"]
    correction_keywords = ["sorry", "wrong", "actually", "change", "correct", "update", "not apollo", "not fortis", "it was", "should be", "meant to say"]
    is_additive   = any(k in msg.lower() for k in additive_keywords)
    is_correction = any(k in msg.lower() for k in correction_keywords)

    if is_additive:
        mode_instruction = """This is an ADDITIVE message (user is adding more info, not correcting).
RULE: Return ONLY the fields explicitly mentioned in this message. Return null for ALL other fields.
Do NOT re-infer or change sentiment, topics, or other fields that are not mentioned here."""
    elif is_correction:
        mode_instruction = """This is a CORRECTION message (user is fixing a mistake).
RULE: Return ONLY the specific fields being corrected. Return null for all other fields."""
    else:
        mode_instruction = """This is a FRESH description or a follow-up command.
Extract all fields you can find. Return null for anything not mentioned."""

    extraction_prompt = f"""You are a CRM assistant helping a pharma field rep fill an interaction form.
Today: {today}

{prev}

User message: "{msg}"

{mode_instruction}

Return ONLY valid JSON with these exact keys (null = not mentioned / do not change):

{{
  "hcp_name": null,
  "hospital": null,
  "interaction_type": null,
  "interaction_date": null,
  "interaction_time": null,
  "attendees": null,
  "topics_discussed": null,
  "materials_shared": null,
  "samples_distributed": null,
  "sentiment": null,
  "outcomes": null,
  "follow_up_actions": null,
  "follow_up_date": null
}}

STRICT RULES:
- null means "I did not extract this field from the message" — the existing value will be kept
- NEVER infer sentiment from an additive message about samples/outcomes — only set sentiment if user explicitly says positive/negative/neutral
- NEVER change topics_discussed unless user explicitly mentions new topics
- interaction_date: "{today}" if "today", subtract 1 day for "yesterday", null if not mentioned
- interaction_type: "Meeting" if "met/visited", "Call" if "called", null if not mentioned

Return JSON only:"""

    try:
        response = await llm.ainvoke(extraction_prompt)
        new_fields = _parse_json_from_llm(response.content)
    except Exception as e:
        return {
            "reply": f"Sorry, I had trouble understanding that. Could you rephrase? ({str(e)})",
            "fields": payload.current_fields,
            "ready_to_submit": False,
        }

    # Merge: start with current fields, apply non-null new values on top
    if payload.current_fields:
        merged = dict(payload.current_fields)
        for k, v in new_fields.items():
            if v is not None:
                merged[k] = v
        fields = merged
    else:
        # First message — set defaults for any still-null required fields
        fields = new_fields
        if not fields.get("interaction_date"):
            fields["interaction_date"] = today
        if not fields.get("interaction_type"):
            fields["interaction_type"] = "Meeting"
        if not fields.get("sentiment"):
            fields["sentiment"] = "Neutral"

    # Build conversational reply
    hcp    = fields.get("hcp_name")
    date_  = fields.get("interaction_date") or today
    sent   = fields.get("sentiment") or "Neutral"
    topics = fields.get("topics_discussed")
    mats   = fields.get("materials_shared")
    fu     = fields.get("follow_up_actions")
    hosp   = fields.get("hospital")

    if wants_submit:
        reply = (
            f"✅ Submitting the interaction for **{hcp or 'the doctor'}**.\n"
            f"The details — HCP name, date, sentiment"
            + (f", materials" if mats else "")
            + (f", follow-up" if fu else "")
            + " — have been automatically populated based on your description."
        )
    else:
        # Build confirmation
        parts = [f"Interaction details have been automatically populated based on your summary."]
        detail_lines = []
        if hcp:    detail_lines.append(f"👤 **HCP Name:** {hcp}" + (f" @ {hosp}" if hosp else ""))
        if date_:  detail_lines.append(f"📅 **Date:** {date_}")
        if sent:   detail_lines.append(f"💬 **Sentiment:** {sent}")
        if topics: detail_lines.append(f"📋 **Topics:** {topics[:80]}{'…' if len(topics or '')>80 else ''}")
        if mats:   detail_lines.append(f"📦 **Materials:** {mats}")
        if fu:     detail_lines.append(f"🔔 **Follow-up:** {fu}")

        reply = "\n".join(parts)
        if detail_lines:
            reply += "\n\n" + "\n".join(detail_lines)

        # Ask about missing important fields
        missing = []
        if not fields.get("follow_up_actions"): missing.append("follow-up actions (e.g. scheduling a meeting)")
        if not fields.get("outcomes"):          missing.append("key outcomes or agreements")

        if missing:
            reply += f"\n\nWould you like me to suggest **{missing[0]}**? Or type any corrections and I'll update the form. When everything looks good, say **'submit'** to save."
        else:
            reply += "\n\nEverything looks filled! Review the form above, make any changes manually, then say **'submit'** or click the button to save."

    return {
        "reply":           reply,
        "fields":          fields,
        "ready_to_submit": wants_submit,
    }


@router.get("/summarize/{hcp_name}")
async def summarize_hcp(hcp_name: str, db: AsyncSession = Depends(get_db)):
    from agent.tools import summarize_hcp_tool
    return await summarize_hcp_tool(hcp_name=hcp_name, db=db)


@router.get("/recommend/{hcp_name}")
async def recommend_for_hcp(hcp_name: str, db: AsyncSession = Depends(get_db)):
    from agent.tools import recommend_actions_tool
    return await recommend_actions_tool(hcp_name=hcp_name, db=db)
