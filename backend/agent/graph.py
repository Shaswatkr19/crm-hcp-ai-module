# backend/agent/graph.py
"""
LangGraph Agent — CRM HCP Module
Maintains conversation context: current_hcp + last_interaction_id
"""

from typing import Any, Dict, List, Optional, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from sqlalchemy.ext.asyncio import AsyncSession

from agent.tools import (
    log_interaction_tool,
    edit_interaction_tool,
    search_interactions_tool,
    summarize_hcp_tool,
    recommend_actions_tool,
    get_llm,
    _parse_json_from_llm,
)


# ── Agent State ──────────────────────────────────────────────────────────────

class AgentState(TypedDict):
    user_message:        str
    # Conversation context passed in from frontend
    current_hcp:         Optional[str]
    last_interaction_id: Optional[int]
    # Internal
    tool_name:           str
    tool_args:           Dict[str, Any]
    tool_result:         Dict[str, Any]
    final_reply:         str
    db:                  Any


# ── Node 1: Classify Intent ──────────────────────────────────────────────────

async def classify_intent(state: AgentState) -> AgentState:
    llm   = get_llm()
    today = __import__("datetime").date.today().isoformat()

    # Build context hint for the LLM
    ctx_parts = []
    if state.get("current_hcp"):
        ctx_parts.append(f'Current doctor in conversation: "{state["current_hcp"]}"')
    if state.get("last_interaction_id"):
        ctx_parts.append(f'Last interaction ID logged/edited: {state["last_interaction_id"]}')
    context_hint = "\n".join(ctx_parts) if ctx_parts else "No prior context."

    system = f"""You are an intent classifier for a pharma CRM assistant.
Today: {today}

CONVERSATION CONTEXT (use this when user doesn't specify):
{context_hint}

RULES:
- If user says "update sentiment", "change follow-up", "edit it" etc WITHOUT giving an ID → use last_interaction_id from context
- If user says "her", "him", "the doctor", "same doctor" → use current_hcp from context
- If user says "what should I prepare", "next visit", "recommend" → recommend_actions
- If user says "summarize", "history with", "how has it been" → summarize_hcp
- If user says "show", "find", "list", "search" past meetings → search_interactions
- If user describes a NEW meeting/call/visit → log_interaction

TOOLS:

1. log_interaction
   Triggers: user describes a meeting that happened
   Args: {{"raw_text": "<full message>"}}

2. edit_interaction
   Triggers: update/change/edit existing record
   If no ID given in message, use last_interaction_id from context.
   Args: {{"interaction_id": <int>, "updates": {{"field": "value"}}}}
   Editable fields: sentiment, follow_up_actions, topics_discussed, outcomes, follow_up_date, interaction_type

3. search_interactions
   Triggers: show/find/list past interactions
   "Last month" = first to last day of previous month
   Args: {{"hcp_name": "<name or null>", "from_date": "<YYYY-MM-DD or null>", "to_date": "<YYYY-MM-DD or null>"}}

4. summarize_hcp
   Triggers: summarize/overview/history/relationship with doctor
   If no name given, use current_hcp from context.
   Args: {{"hcp_name": "<name>"}}

5. recommend_actions
   Triggers: prepare/recommend/next visit/what should I do/suggestions
   If no name given, use current_hcp from context.
   Args: {{"hcp_name": "<name>"}}

Return ONLY valid JSON, no explanation:
{{"tool": "<name>", "args": {{...}}}}"""

    response = await llm.ainvoke([
        SystemMessage(content=system),
        HumanMessage(content=state["user_message"]),
    ])

    parsed = _parse_json_from_llm(response.content)
    tool   = parsed.get("tool", "log_interaction")
    args   = parsed.get("args", {"raw_text": state["user_message"]})

    # ── Safety: inject context when LLM missed it ─────────────────────────

    # edit_interaction — fill missing ID from context
    if tool == "edit_interaction":
        if not args.get("interaction_id") and state.get("last_interaction_id"):
            args["interaction_id"] = state["last_interaction_id"]
        # If still no ID, fall back gracefully
        if not args.get("interaction_id"):
            args["interaction_id"] = 0

    # summarize / recommend — fill missing hcp_name from context
    if tool in ("summarize_hcp", "recommend_actions"):
        if not args.get("hcp_name") and state.get("current_hcp"):
            args["hcp_name"] = state["current_hcp"]

    # search — fill missing hcp_name from context (only if user said "her/him/same")
    if tool == "search_interactions":
        msg_lower = state["user_message"].lower()
        if not args.get("hcp_name") and state.get("current_hcp"):
            if any(w in msg_lower for w in ["her", "him", "same", "this doctor", "the doctor"]):
                args["hcp_name"] = state["current_hcp"]

    return {**state, "tool_name": tool, "tool_args": args}


# ── Node 2: Execute Tool ─────────────────────────────────────────────────────

async def execute_tool(state: AgentState) -> AgentState:
    tool = state["tool_name"]
    args = state["tool_args"]
    db   = state["db"]
    result: Dict[str, Any] = {}

    try:
        if tool == "log_interaction":
            result = await log_interaction_tool(
                raw_text=args.get("raw_text", state["user_message"]), db=db)

        elif tool == "edit_interaction":
            result = await edit_interaction_tool(
                interaction_id=int(args.get("interaction_id") or 0),
                updates=args.get("updates", {}), db=db)

        elif tool == "search_interactions":
            result = await search_interactions_tool(
                hcp_name=args.get("hcp_name"),
                from_date=args.get("from_date"),
                to_date=args.get("to_date"),
                limit=args.get("limit", 10), db=db)

        elif tool == "summarize_hcp":
            result = await summarize_hcp_tool(
                hcp_name=args.get("hcp_name", ""), db=db)

        elif tool == "recommend_actions":
            result = await recommend_actions_tool(
                hcp_name=args.get("hcp_name", ""), db=db)

        else:
            result = {"success": False, "error": f"Unknown tool: {tool}"}

    except Exception as e:
        result = {"success": False, "error": str(e)}

    return {**state, "tool_result": result}


# ── Node 3: Format Response ──────────────────────────────────────────────────

async def format_response(state: AgentState) -> AgentState:
    """CRM-style concise responses. No emails, no greetings."""
    result = state["tool_result"]
    tool   = state["tool_name"]

    # ── Error ─────────────────────────────────────────────────────────────
    if not result.get("success"):
        error = result.get("error", "Unknown error")
        final = f"⚠️ {error}"
        return {**state, "final_reply": final}

    # ── log_interaction ───────────────────────────────────────────────────
    if tool == "log_interaction":
        hcp   = result.get("hcp_name", "—")
        id_   = result.get("interaction_id", "?")
        date_ = result.get("interaction_date", "")
        sent  = result.get("sentiment", "")
        topics= result.get("topics_discussed", "")
        fu    = result.get("follow_up_actions", "")
        lines = [f"✅ Interaction logged — ID #{id_}"]
        if hcp:    lines.append(f"👤 HCP: {hcp}")
        if date_:  lines.append(f"📅 Date: {date_}")
        if sent:   lines.append(f"💬 Sentiment: {sent}")
        if topics: lines.append(f"📋 Topics: {topics}")
        if fu:     lines.append(f"🔔 Follow-up: {fu}")
        final = "\n".join(lines)

    # ── edit_interaction ──────────────────────────────────────────────────
    elif tool == "edit_interaction":
        id_    = result.get("interaction_id", "?")
        fields = result.get("updated_fields", [])
        final  = (
            f"✅ Interaction #{id_} updated.\n"
            f"📝 Changed: {', '.join(fields)}"
        )

    # ── search_interactions ───────────────────────────────────────────────
    elif tool == "search_interactions":
        count = result.get("count", 0)
        hcp   = state["tool_args"].get("hcp_name", "")
        if count == 0:
            final = f"🔍 No interactions found" + (f" for {hcp}" if hcp else "") + "."
        else:
            final = (
                f"🔍 {count} interaction{'s' if count != 1 else ''} found"
                + (f" for **{hcp}**" if hcp else "")
                + "\nResults shown below ↓"
            )

    # ── summarize_hcp ─────────────────────────────────────────────────────
    elif tool == "summarize_hcp":
        hcp   = result.get("hcp_name", "")
        total = result.get("total_interactions", 0)
        summ  = result.get("summary", "")
        if total == 0:
            final = f"📋 No history found for **{hcp}** yet.\nLog your first meeting to start building a profile."
        else:
            final = f"📋 **Summary — {hcp}** ({total} interaction{'s' if total!=1 else ''})\n\n{summ}"

    # ── recommend_actions ─────────────────────────────────────────────────
    elif tool == "recommend_actions":
        hcp  = result.get("hcp_name", "")
        recs = result.get("recommendations", [])
        if not recs:
            final = f"💡 No recommendations available for **{hcp}**."
        else:
            lines = [f"💡 **Recommended actions for {hcp}:**\n"]
            lines += [f"{i+1}. {r}" for i, r in enumerate(recs)]
            final  = "\n".join(lines)

    else:
        final = result.get("message", "✅ Done.")

    return {**state, "final_reply": final}


# ── Graph ────────────────────────────────────────────────────────────────────

def build_agent_graph():
    g = StateGraph(AgentState)
    g.add_node("classify_intent", classify_intent)
    g.add_node("execute_tool",    execute_tool)
    g.add_node("format_response", format_response)
    g.set_entry_point("classify_intent")
    g.add_edge("classify_intent", "execute_tool")
    g.add_edge("execute_tool",    "format_response")
    g.add_edge("format_response", END)
    return g.compile()

agent_graph = build_agent_graph()


# ── Public API ───────────────────────────────────────────────────────────────

async def run_agent(
    user_message:        str,
    db:                  AsyncSession,
    current_hcp:         Optional[str] = None,
    last_interaction_id: Optional[int] = None,
) -> Dict[str, Any]:

    final_state = await agent_graph.ainvoke({
        "user_message":        user_message,
        "current_hcp":         current_hcp,
        "last_interaction_id": last_interaction_id,
        "tool_name":           "",
        "tool_args":           {},
        "tool_result":         {},
        "final_reply":         "",
        "db":                  db,
    })

    tool        = final_state["tool_name"]
    tool_result = final_state["tool_result"]

    # ── Build typed fields for frontend ──────────────────────────────────
    interaction = None
    suggestions = None
    results     = None

    if tool == "log_interaction" and tool_result.get("success"):
        interaction = {
            "id":                tool_result.get("interaction_id"),
            "interaction_id":    tool_result.get("interaction_id"),
            "hcp_name":          tool_result.get("hcp_name"),
            "interaction_type":  tool_result.get("interaction_type"),
            "interaction_date":  tool_result.get("interaction_date"),
            "sentiment":         tool_result.get("sentiment"),
            "topics_discussed":  tool_result.get("topics_discussed"),
            "follow_up_actions": tool_result.get("follow_up_actions"),
        }

    elif tool == "recommend_actions" and tool_result.get("success"):
        recs = tool_result.get("recommendations", [])
        suggestions = recs if recs else None

    elif tool == "search_interactions" and tool_result.get("success"):
        ints = tool_result.get("interactions", [])
        results = ints if ints else None

    # ── Derive updated context to send back to frontend ───────────────────
    new_current_hcp = current_hcp
    new_last_id     = last_interaction_id

    # Update current_hcp when a doctor is mentioned
    if tool == "log_interaction" and tool_result.get("hcp_name"):
        new_current_hcp = tool_result["hcp_name"]
        new_last_id     = tool_result.get("interaction_id")
    elif tool == "edit_interaction" and tool_result.get("success"):
        new_last_id = tool_result.get("interaction_id", last_interaction_id)
    elif tool in ("summarize_hcp", "recommend_actions") and tool_result.get("hcp_name"):
        new_current_hcp = tool_result["hcp_name"]
    elif tool == "search_interactions":
        args_hcp = final_state["tool_args"].get("hcp_name")
        if args_hcp:
            new_current_hcp = args_hcp

    return {
        "reply":               final_state["final_reply"],
        "action":              tool,
        "tool_result":         tool_result,
        "interaction":         interaction,
        "suggestions":         suggestions,
        "results":             results,
        "current_hcp":         new_current_hcp,
        "last_interaction_id": new_last_id,
    }
