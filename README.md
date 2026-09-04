# CIVICOS — CivicFix Hyderabad

**An AI-powered civic issue reporting platform.**

Take a photo of a pothole, garbage pile, or broken street light in Hyderabad —
CivicFix identifies the issue, routes it to the right civic department, and
lets residents track the fix. Built for a hackathon, designed to grow.

> **Status: full agent pipeline implemented.** Vision, location, routing,
> and complaint agents all work and `POST /complaints/analyze` returns the
> vision analysis + location + assigned GHMC department. Complaints save to
> Supabase (photo → Storage → `image_url`) with a CF- tracking ID. Still
> upcoming: tracking status updates, wiring the LangGraph pipeline into the
> endpoints, and authentication.

## Tech stack

| Layer     | Technology                                              | Status                                    |
| --------- | ------------------------------------------------------- | ----------------------------------------- |
| Frontend  | Next.js (App Router) + TypeScript + Tailwind CSS        | Working                                   |
| Backend   | Python + FastAPI                                        | Working                                   |
| Database  | Supabase                                                | SDK wired — add keys + run schema.sql     |
| AI        | Featherless AI (OpenAI-compatible)                      | Vision agent live; needs `FEATHERLESS_API_KEY` |
| Workflows | LangGraph (agent orchestration)                         | Drafted, not wired to an endpoint yet     |
| API       | REST (frontend calls the FastAPI backend)               | `/health` + `/complaints/analyze`         |

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
│   │   ├── agents/            # AI agents (vision + tracking-ID live; rest are stubs)
│   │   ├── services/          # Integrations (Featherless + Supabase wired)
│   │   ├── schemas/           # Future request/response models
│   │   └── workflows/         # LangGraph pipeline (drafted, unwired)
│   ├── api/                   # Vercel entrypoint (mounts app under /api/backend)
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
│
├── vercel.json                # Vercel Services monorepo config
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

Optional — enable AI analysis (`POST /complaints/analyze`): copy
`backend/.env.example` to `backend/.env` and set `FEATHERLESS_API_KEY`. The
health check and the rest of the API work fine without it.

### 2. Frontend (Next.js) — terminal 2

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and click **Check Backend** — the page reports
whether the API is reachable (this exercises CORS between the two dev servers).
Full backend instructions are in `backend/README.md`.

## Deploy to Vercel

The repo is configured as a **Vercel Services** project (`vercel.json`): the
Next.js frontend and the FastAPI backend deploy together on one domain.

```
vercel.json
  services:
    frontend  (root: frontend/, framework: nextjs)
    backend   (root: backend/,  framework: fastapi, entrypoint: api.index:app)
  rewrites:
    /api/backend/*  -> backend service
    /*              -> frontend service
```

**Steps**

1. Push this repo to GitHub.
2. In the Vercel dashboard, **Add New Project** and import the repo.
3. In the project's **Build & Deployment Settings**, set the **Framework
   Preset** to **Services** (required for `vercel.json`'s `services` key to
   take effect).
4. Deploy. The backend entrypoint is `backend/api/index.py`, which mounts the
   FastAPI app under `/api/backend` to match the rewrite prefix.
5. Set environment variables: **Project → Settings → Environment Variables**
   → add `FEATHERLESS_API_KEY` (from https://featherless.ai), then redeploy.
   The health check works without it; `POST /complaints/analyze` needs it.

**How the paths line up**

Vercel forwards the original request path to a service (it does not strip the
rewrite prefix), so `GET /api/backend/health` arrives at the backend as
`/api/backend/health`. The entrypoint mounts the app at that same prefix, so
FastAPI sees `/health` and matches normally. No CORS is needed in production
because the browser calls the same origin; the CORS middleware still applies
when running the two dev servers locally.

**Local development** is unchanged - run the backend with `uvicorn` and the
frontend with `npm run dev` as described in the Quickstart above. You can also
run everything together with the Vercel CLI: `npx vercel dev`.

## Roadmap (later milestones)

1. Complaint intake: form + `POST /complaints` + tracking ID
2. Supabase persistence (users, complaints, statuses)
3. ~~Image upload + storage~~ ✅ (Supabase Storage, linked via `image_url`)
4. ~~Implement the remaining agents: location → routing → complaint~~ ✅ (tracking status still pending)
5. Wire the LangGraph workflow (`complaint_workflow.py`) into the analyze flow
6. User dashboards, maps, and status updates
