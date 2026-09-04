# CivicFix Hyderabad

**An AI-powered civic issue reporting platform.**

Take a photo of a pothole, garbage pile, or broken street light in Hyderabad —
CivicFix identifies the issue, routes it to the right civic department, and
lets residents track the fix. Built for a hackathon, designed to grow.

> **Status: foundation scaffold only.** This repo currently contains the
> project structure plus a working frontend ↔ backend health check. No
> authentication, AI, database, or upload features exist yet.

## Tech stack

| Layer     | Technology                                              | Status              |
| --------- | ------------------------------------------------------- | ------------------- |
| Frontend  | Next.js (App Router) + TypeScript + Tailwind CSS        | Scaffolded          |
| Backend   | Python + FastAPI                                        | Scaffolded          |
| Database  | Supabase                                                | Not connected yet   |
| AI        | Featherless AI                                          | Not connected yet   |
| Workflows | LangGraph (agent orchestration)                         | Not implemented yet |
| API       | REST (frontend calls the FastAPI backend)               | /health working     |

## Repository layout

```
.
├── frontend/                  # Next.js + TypeScript + Tailwind app
│   ├── app/                   # App Router pages (layout, landing page, styles)
│   ├── components/            # React components (health check widget)
│   ├── services/              # API client for the FastAPI backend
│   ├── public/                # Static assets
│   ├── package.json
│   └── .env.local.example
│
├── backend/                   # FastAPI service
│   ├── app/
│   │   ├── main.py            # FastAPI app + CORS + router mounting
│   │   ├── config.py          # Central settings (env-driven)
│   │   ├── routes/            # API endpoints (health, complaints)
│   │   ├── agents/            # Future AI agents (placeholders only)
│   │   ├── services/          # Future integrations (placeholders only)
│   │   ├── schemas/           # Future request/response models
│   │   └── workflows/         # Future LangGraph pipeline (placeholder)
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── .gitignore
└── README.md
```

## Quickstart

### 1. Backend (FastAPI) — terminal 1

```bash
cd backend
python -m venv .venv
# Windows (Git Bash):  source .venv/Scripts/activate
# PowerShell:          .venv\Scripts\Activate.ps1
# macOS / Linux:       source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Verify: http://localhost:8000/health → `{"status":"ok","service":"civicfix-backend"}`
Interactive API docs: http://localhost:8000/docs

### 2. Frontend (Next.js) — terminal 2

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and click **Check Backend** — the page reports
whether the API is reachable (this exercises CORS between the two dev servers).
Full instructions are in `backend/README.md`.

## Roadmap (later milestones)

1. Complaint intake: form + `POST /complaints` + tracking ID
2. Supabase persistence (users, complaints, statuses)
3. Image upload + storage (Supabase Storage)
4. Featherless integration: vision + text models
5. Agents: vision → location → routing → tracking
6. LangGraph workflow wiring the agents together
7. User dashboards, maps, and status updates
