# backend/routes/agent_routes.py
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, Interaction
from schemas import ChatMessage, AgentResponse, InteractionOut
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

    # Interaction card (log_interaction)
    interaction_out = None
    if action == "log_interaction" and tool_result.get("success"):
        iid = tool_result.get("interaction_id")
        if iid:
            res = await db.execute(select(Interaction).where(Interaction.id == iid))
            row = res.scalar_one_or_none()
            if row:
                interaction_out = InteractionOut.model_validate(row)

    # Recommendations
    suggestions: Optional[List[str]] = None
    if action == "recommend_actions" and tool_result.get("success"):
        recs = tool_result.get("recommendations", [])
        suggestions = recs if recs else None

    # Search results
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


@router.get("/summarize/{hcp_name}")
async def summarize_hcp(hcp_name: str, db: AsyncSession = Depends(get_db)):
    from agent.tools import summarize_hcp_tool
    return await summarize_hcp_tool(hcp_name=hcp_name, db=db)


@router.get("/recommend/{hcp_name}")
async def recommend_for_hcp(hcp_name: str, db: AsyncSession = Depends(get_db)):
    from agent.tools import recommend_actions_tool
    return await recommend_actions_tool(hcp_name=hcp_name, db=db)
