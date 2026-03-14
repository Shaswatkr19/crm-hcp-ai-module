# CRM HCP Module — AI-First Interaction Logger

An AI-powered CRM system for pharmaceutical field representatives to log, manage, and analyze interactions with Healthcare Professionals (HCPs). Built for the Python Developer Internship — Round 1 Technical Assignment.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     FRONTEND  (React 18 + Redux)                  │
│                                                                    │
│   Dashboard  |  Log Interaction  |  AI Assistant                  │
│   HCP Directory  |  Settings                                      │
│                                                                    │
│   Structured Form ──────────────────► POST /interactions/         │
│   AI Chat ──────────────────────────► POST /agent/chat            │
└─────────────────────────┬────────────────────────────────────────┘
                           │ HTTP / JSON
┌─────────────────────────▼────────────────────────────────────────┐
│                     BACKEND  (FastAPI + Python)                    │
│                                                                    │
│   /interactions  (CRUD)          /agent/chat                      │
│          │                            │                           │
│          ▼                            ▼                           │
│   SQLAlchemy ORM            LangGraph Agent                       │
│                                       │                           │
│                            classify_intent                        │
│                                  ↓                                │
│                            execute_tool ──► Groq (gemma2-9b-it)   │
│                                  ↓                                │
│                            format_response                        │
│                                                                    │
└──────────┬────────────────────────────────────────────────────────┘
           │
┌──────────▼────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                            │
│           hcps  |  interactions  |  ai_suggestions                 │
└───────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
crm-hcp-module/
├── backend/
│   ├── main.py                   # FastAPI app + lifespan
│   ├── config.py                 # pydantic-settings (.env reader)
│   ├── database.py               # SQLAlchemy async ORM models
│   ├── schemas.py                # Pydantic v2 request/response schemas
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   ├── interactions.py       # CRUD: interactions + HCPs
│   │   └── agent_routes.py       # AI chat + summarize + recommend
│   └── agent/
│       ├── tools.py              # 5 LangGraph tools
│       └── graph.py              # StateGraph (classify → execute → respond)
│
├── frontend/
│   ├── index.html                # Google Inter font loaded here
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx               # Router + Sidebar (reads localStorage for profile)
│       ├── main.jsx
│       ├── api/api.js            # Axios client with context support
│       ├── store/
│       │   ├── index.js
│       │   └── interactionSlice.js
│       ├── pages/
│       │   ├── Dashboard.jsx        # Stats + Recharts + Activity feed
│       │   ├── LogInteraction.jsx   # Form + AI sidebar + AI suggested follow-ups
│       │   ├── AIAssistant.jsx      # Full-screen context-aware chat
│       │   ├── HCPDirectory.jsx     # Card grid + Add HCP + detail modal
│       │   └── Settings.jsx         # 6 sections, localStorage persist
│       ├── components/
│       │   └── InteractionList.jsx  # Table + Edit modal + Mobile cards
│       └── styles/global.css        # Full responsive CSS
│
└── database/
    ├── schema.sql                 # Tables + seed HCPs + seed interactions
    └── seed_interactions.sql      # Run separately on existing DBs
```

---

## LangGraph Agent — 5 Tools

The agent runs a 3-node graph: `classify_intent → execute_tool → format_response`

The agent is context-aware. It remembers the current doctor and last interaction ID across messages, so the field rep can say "update sentiment to Positive" without specifying an ID and the agent uses the last one automatically.

| Tool | Purpose |
|------|---------|
| log_interaction | Parses free text, Groq LLM extracts structured fields, saves to PostgreSQL |
| edit_interaction | Updates existing record by ID — auto-filled from context if not specified |
| search_interactions | Fuzzy search by HCP name and optional date range |
| summarize_hcp | LLM generates bullet-point relationship summary from full history |
| recommend_actions | LLM gives 3 to 5 actionable next-visit recommendations |

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+ running locally
- Free Groq API key from console.groq.com

### Step 1 — Database

```bash
psql -U postgres -c "CREATE DATABASE crm_hcp;"
psql -U postgres -d crm_hcp -f database/schema.sql
```

### Step 2 — Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate
# Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env and set DATABASE_URL and GROQ_API_KEY

uvicorn main:app --reload --port 8000
```

API: http://localhost:8000
Swagger docs: http://localhost:8000/docs

### Step 3 — Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL async connection string | postgresql+asyncpg://postgres:pass@localhost:5432/crm_hcp |
| GROQ_API_KEY | Groq API key | gsk_xxxxxxxxxxxx |
| LLM_MODEL | Model name | gemma2-9b-it |
| APP_ENV | Environment | development |
| CORS_ORIGINS | Allowed origins | http://localhost:5173 |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| GET | /interactions/hcps | List all HCPs |
| POST | /interactions/hcps | Add new HCP |
| POST | /interactions/ | Create interaction via form |
| GET | /interactions/ | List interactions with filters |
| GET | /interactions/{id} | Get single interaction |
| PATCH | /interactions/{id} | Update interaction |
| DELETE | /interactions/{id} | Delete interaction |
| POST | /agent/chat | AI agent — all 5 tools, context-aware |
| POST | /agent/tool/log | Direct log tool bypasses classifier |
| GET | /agent/summarize/{hcp_name} | Summarize HCP history |
| GET | /agent/recommend/{hcp_name} | Get next-action recommendations |

---

## Features

- Dual input — structured form with voice dictation and AI conversational chat
- Context-aware agent — remembers current doctor and last interaction ID across messages
- 5 LangGraph tools with automatic intent classification
- Edit interactions via UI modal or chat without needing to specify an ID
- Add new HCPs directly from the directory page
- Dashboard with monthly bar chart and sentiment pie chart using Recharts
- Upcoming follow-up tracker on dashboard
- AI summary and next-action recommendations per HCP
- AI suggested follow-ups section on the Log Interaction form
- Full-screen AI Assistant page with structured result cards
- Fully responsive — mobile hamburger menu, table collapses to cards on small screens
- Settings persist across browser sessions via localStorage
- Sidebar profile name updates in real time when Settings are saved

---

## AI Chat Examples

```
# Log a new meeting
Met Dr. Priya Sharma at Apollo today. Discussed OncoPen X insulin pen.
She was very interested and asked for Phase III data. Follow up next Monday.

# Edit without specifying ID — agent uses context automatically
Update sentiment to Positive and add follow up: send Phase III PDF

# Search past interactions
Show me all interactions with Dr. Verma from last month

# Summarize relationship
Summarize my complete history with Dr. Anita Menon

# Get recommendations for next visit
What should I prepare for my next visit with Dr. Suresh Patel?
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Redux Toolkit, React Router v6, Vite |
| Charts | Recharts |
| HTTP Client | Axios |
| Styling | Custom CSS, Google Inter font |
| Backend | FastAPI, Pydantic v2, Uvicorn |
| ORM | SQLAlchemy 2.x async |
| Database | PostgreSQL 14+ |
| AI Framework | LangGraph |
| LLM Client | LangChain-Groq |
| LLM Model | gemma2-9b-it via Groq |
| Voice Input | Web Speech API — Chrome only |