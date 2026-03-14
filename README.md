# 🏥 CRM HCP Module — AI-First Log Interaction Screen

> An AI-powered CRM feature for pharma field representatives to log, search, and analyze interactions with Healthcare Professionals (HCPs).

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Redux)                  │
│  ┌──────────────┐  ┌──────────────────────────────────────────┐ │
│  │  Form Logger  │  │  AI Chat Logger                          │ │
│  │  (Structured) │  │  "Met Dr. Sharma today, discussed..."    │ │
│  └──────┬───────┘  └──────────────┬───────────────────────────┘ │
│         │ REST                     │ REST /agent/chat             │
└─────────┼─────────────────────────┼─────────────────────────────┘
          │                         │
          ▼                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI / Python)                    │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐ │
│  │  /interactions (CRUD) │   │  /agent/chat                     │ │
│  └──────────────────────┘   └──────────┬─────────────────────── ┘ │
└───────────────────────────────────────┼─────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LANGGRAPH AI AGENT                             │
│                                                                   │
│  classify_intent ──▶ execute_tool ──▶ format_response            │
│       │                  │                                        │
│       │            ┌─────┴──────────────────────────┐           │
│       │            │  Tool 1: log_interaction         │           │
│       │            │  Tool 2: edit_interaction        │           │
│       │            │  Tool 3: search_interactions     │           │
│       │            │  Tool 4: summarize_hcp           │           │
│       │            │  Tool 5: recommend_actions       │           │
│       │            └──────────────────────────────────┘           │
│       │                  │                                        │
│       └── Groq API (gemma2-9b-it) ◀──────────────────────────── │
└─────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PostgreSQL Database                         │
│   hcps  │  interactions  │  ai_suggestions                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Project Structure

```
crm-hcp-module/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Settings (env vars)
│   ├── database.py              # SQLAlchemy ORM models & DB session
│   ├── schemas.py               # Pydantic v2 schemas
│   ├── requirements.txt
│   ├── .env.example
│   ├── routes/
│   │   ├── interactions.py      # CRUD REST endpoints
│   │   └── agent_routes.py      # AI agent endpoints
│   └── agent/
│       ├── __init__.py
│       ├── tools.py             # 5 LangGraph tools
│       └── graph.py             # LangGraph StateGraph definition
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Root component with layout
│       ├── api/
│       │   └── api.js           # Axios API client
│       ├── store/
│       │   ├── index.js         # Redux store
│       │   └── interactionSlice.js  # Redux slice (async thunks)
│       ├── components/
│       │   ├── FormLogger.jsx   # Structured form UI
│       │   ├── ChatLogger.jsx   # AI chat UI
│       │   └── InteractionList.jsx  # History table
│       └── styles/
│           └── global.css       # All styles (Inter font, clinical theme)
│
├── database/
│   └── schema.sql               # Raw SQL schema with seed data
│
└── README.md
```

---

## 🤖 LangGraph Agent — 5 Tools Explained

### Tool 1: `log_interaction`
**Purpose**: Converts unstructured free text into a structured CRM record.

**Flow**:
1. Receives raw text: *"Met Dr. Sharma, discussed insulin pens, positive response"*
2. Sends to Groq `gemma2-9b-it` with extraction prompt
3. LLM returns JSON with: `hcp_name`, `sentiment`, `topics_discussed`, `follow_up_actions`, etc.
4. Saves `Interaction` row to PostgreSQL
5. Returns the saved record ID and confirmation

### Tool 2: `edit_interaction`
**Purpose**: Updates an existing interaction record by ID.

**Flow**:
1. Receives `interaction_id` + dict of fields to update
2. Validates interaction exists in DB
3. Applies only non-null field changes
4. Returns updated record

### Tool 3: `search_interactions`
**Purpose**: Retrieves past interactions filtered by HCP name and/or date range.

**Flow**:
1. Accepts `hcp_name`, `from_date`, `to_date`
2. Runs SQLAlchemy query with `ilike` for fuzzy name matching
3. Returns list of matching interaction summaries

### Tool 4: `summarize_hcp`
**Purpose**: Generates a narrative summary of all interactions with a specific doctor.

**Flow**:
1. Pulls all interactions for the HCP from DB
2. Formats as a timeline context string
3. Sends to LLM: *"Summarize key themes, relationship status, pending actions"*
4. Returns bullet-point summary

### Tool 5: `recommend_actions`
**Purpose**: Provides AI-driven next best actions for a field rep before their next visit.

**Flow**:
1. Pulls last 5 interactions for the HCP
2. Includes sentiment trends, pending follow-ups, topics
3. LLM generates 3–5 specific actionable recommendations
4. Returns numbered list

---

## 🚀 Setup Instructions

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Groq API key from [console.groq.com](https://console.groq.com)

---

### 1. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE crm_hcp;"

# Run schema (optional — tables auto-create on startup)
psql -U postgres -d crm_hcp -f database/schema.sql
```

---

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set:
#   DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/crm_hcp
#   GROQ_API_KEY=your_groq_key_here

# Start the server
uvicorn main:app --reload --port 8000
```

Backend will be available at: **http://localhost:8000**
API docs (Swagger): **http://localhost:8000/docs**

---

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend will be available at: **http://localhost:5173**

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health` | Health check |
| `GET`  | `/interactions/hcps` | List all HCPs |
| `POST` | `/interactions/` | Create interaction (form) |
| `GET`  | `/interactions/` | List all interactions |
| `GET`  | `/interactions/{id}` | Get single interaction |
| `PATCH`| `/interactions/{id}` | Update interaction |
| `DELETE`| `/interactions/{id}` | Delete interaction |
| `POST` | `/agent/chat` | AI chat (all 5 tools) |
| `POST` | `/agent/tool/log` | Direct log via AI |
| `GET`  | `/agent/summarize/{hcp_name}` | Summarize HCP |
| `GET`  | `/agent/recommend/{hcp_name}` | Recommend actions |

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL async URL |
| `GROQ_API_KEY` | Groq API key |
| `LLM_MODEL` | LLM model name (default: `gemma2-9b-it`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |

---

## 🎯 Features

- ✅ **Dual input modes**: Structured form + AI conversational chat
- ✅ **5 LangGraph tools**: Log, Edit, Search, Summarize, Recommend
- ✅ **Groq `gemma2-9b-it`** for fast inference
- ✅ **Redux state management** for frontend
- ✅ **PostgreSQL** with async SQLAlchemy
- ✅ **Clean clinical UI** with Google Inter font
- ✅ **Real-time sentiment tracking** (Positive/Neutral/Negative)
- ✅ **AI follow-up recommendations** per HCP
- ✅ **Interaction history** with search/filter

---

## 📝 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Redux Toolkit, Vite, Axios |
| Styling | Custom CSS, Google Inter font |
| Backend | Python 3.10+, FastAPI, Pydantic v2 |
| AI Agent | LangGraph, LangChain, Groq API |
| LLM Model | `gemma2-9b-it` via Groq |
| Database | PostgreSQL, SQLAlchemy (async) |

---

## 🧪 Example AI Chat Messages

```
"Met Dr. Priya Sharma today at Apollo Hospital. Discussed new insulin pen.
 She seemed very positive. Will share Phase III data next week."

"Show me all interactions with Dr. Verma from last month"

"Summarize my history with Dr. Anita Menon"

"What should I prepare for my next visit with Dr. Suresh Patel?"

"Update interaction 3 — change sentiment to Positive"
```
