# CivicFix Backend

FastAPI service for CivicFix Hyderabad. It exposes a health check and an AI
photo-analysis endpoint (`POST /complaints/analyze`) that uses the Featherless
vision agent to identify civic issues. The location / routing / complaint /
tracking agents and the Supabase database arrive in later milestones.

## Quickstart

```bash
cd backend
python -m venv .venv
# Windows (Git Bash):  source .venv/Scripts/activate
# PowerShell:          .venv\Scripts\Activate.ps1
# macOS / Linux:       source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API root: http://localhost:8000
- Interactive docs (Swagger UI): http://localhost:8000/docs

## Endpoints

| Method | Path                | Description                                                          |
| ------ | ------------------- | -------------------------------------------------------------------- |
| GET    | /health             | Liveness check → `{"status": "ok", "service": "civicfix-backend"}`   |
| POST   | /complaints/analyze | Upload a photo → JSON analysis of the civic issue (needs `FEATHERLESS_API_KEY`) |
| POST   | /complaints         | Create a complaint (JSON) → stored row incl. CF- tracking ID (Supabase) |
| GET    | /complaints         | List recent complaints, newest first (Supabase)                      |
| GET    | /complaints/{tracking_id} | Look up a complaint + status by its CF- tracking ID (Supabase)   |
| GET    | /docs               | Swagger UI for trying endpoints in the browser                       |

## Structure

```
backend/
├── app/
│   ├── main.py               # FastAPI app: CORS + registers routers
│   ├── config.py             # Central settings (reads .env automatically)
│   ├── routes/               # One router module per resource
│   │   ├── health.py         # GET /health
│   │   └── complaints.py     # POST /complaints/analyze (vision analysis)
│   ├── agents/               # AI agents — vision + tracking IDs live, rest are stubs
│   │   ├── vision_agent.py   #   photo analysis (what is the issue?) ✅
│   │   ├── location_agent.py #   where is it? (coords / ward)
│   │   ├── routing_agent.py  #   which department handles it?
│   │   ├── complaint_agent.py#   assemble + validate a complaint record
│   │   └── tracking_agent.py #   collision-safe tracking IDs ✅ (status pending)
│   ├── services/             # Integrations
│   │   ├── featherless_service.py  # Featherless AI (OpenAI-compatible SDK)
│   │   ├── supabase_service.py     # Supabase complaints (needs keys + table)
│   │   └── storage_service.py      # photo storage (pending)
│   ├── schemas/              # Future request/response Pydantic models
│   │   └── complaint_schema.py
│   └── workflows/            # LangGraph pipeline — drafted, not wired yet
│       └── complaint_workflow.py
├── api/
│   └── index.py              # Vercel entrypoint (mounts the app at /api/backend)
├── supabase/
│   └── schema.sql            # complaints table + RLS (run once in the dashboard)
├── requirements.txt
├── .env.example
└── README.md
```

The `__init__.py` files (not shown above) simply mark each folder as a Python
package so `uvicorn app.main:app` can import the modules.

## Configuration

Environment variables are read in `app/config.py`. A `.env` file in this
folder is loaded automatically if present (see `.env.example`). Defaults are
chosen so the app runs without any `.env` file:

| Variable               | Default                                   | Purpose            |
| ---------------------- | ----------------------------------------- | ------------------ |
| CIVICFIX_CORS_ORIGINS  | http://localhost:3000,http://127.0.0.1:3000 | Allowed browser origins (CORS) |
| CIVICFIX_SERVICE_NAME  | civicfix-backend                          | Name reported by /health |
| FEATHERLESS_API_KEY    | (empty)                                   | Featherless key for AI analysis — empty until you add it |
| SUPABASE_URL           | (empty)                                   | Supabase project URL — required for database calls |
| SUPABASE_ANON_KEY      | (empty)                                   | Supabase anon key — required for database calls |

The app boots without `FEATHERLESS_API_KEY`; `POST /complaints/analyze`
answers **502** with a clear message until the key is set (locally in
`backend/.env`, or as a Vercel environment variable in production).
Similarly, database calls fail with a clear message until `SUPABASE_URL` +
`SUPABASE_ANON_KEY` are set and `supabase/schema.sql` has been run once.

## Testing the API

With the server running:

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"civicfix-backend"}

# Upload a photo for vision analysis (requires FEATHERLESS_API_KEY):
curl -X POST -F "file=@pothole.jpg" http://localhost:8000/complaints/analyze
```

Or open http://localhost:8000/docs and press "Try it out".

Uploaded photos are written to the OS temp directory while they are analyzed,
then deleted — locally that keeps the repo clean, and on Vercel it is required
because the serverless filesystem is read-only except for `/tmp`.
