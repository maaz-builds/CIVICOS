# CivicFix Backend

FastAPI service for CivicFix Hyderabad. It exposes a health check, an AI
photo-analysis endpoint (`POST /complaints/analyze`) that identifies the
civic issue, geocodes it, and routes it to the responsible GHMC department,
and Supabase-backed complaint persistence with CF- tracking IDs. The
LangGraph pipeline is wired into the analyze endpoint, and the GHMC demo
portal closes the loop: it lists real complaints and advances their
lifecycle status (submitted → assigned → in progress → resolved), which
citizens see immediately on the /track page.

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
| POST   | /complaints         | Create a complaint (multipart form) → stored row incl. CF- tracking ID; pass `file` to upload the photo to Supabase Storage (linked via `image_url`) |
| GET    | /complaints         | List recent complaints, newest first (Supabase)                      |
| GET    | /complaints/{tracking_id} | Look up a complaint + status by its CF- tracking ID (Supabase)   |
| PATCH  | /complaints/{tracking_id}/status | Advance a complaint's status (GHMC portal action) → updated row; invalid statuses get 422 |
| GET    | /docs               | Swagger UI for trying endpoints in the browser                       |

## Structure

```
backend/
├── app/
│   ├── main.py               # FastAPI app: CORS + registers routers
│   ├── config.py             # Central settings (reads .env automatically)
│   ├── routes/               # One router module per resource
│   │   ├── health.py         # GET /health
│   │   └── complaints.py     # analyze (LangGraph), create, list, lookup, status PATCH
│   ├── agents/               # AI agents — all five implemented ✅
│   │   ├── vision_agent.py   #   photo analysis (what is the issue?) ✅
│   │   ├── location_agent.py #   where is it? (coords / ward) ✅ AI-primary
│   │   ├── routing_agent.py  #   which department handles it? ✅ (AI + rules)
│   │   ├── complaint_agent.py#   assemble + validate a complaint record ✅
│   │   └── tracking_agent.py #   collision-safe tracking IDs ✅
│   ├── services/             # Integrations
│   │   ├── featherless_service.py  # Featherless AI (OpenAI-compatible SDK)
│   │   ├── supabase_service.py     # Supabase complaints (needs keys + table)
│   │   └── storage_service.py      # photo upload → Supabase Storage → image_url
│   ├── schemas/              # Request/response Pydantic models
│   │   └── complaint_schema.py
│   └── workflows/            # LangGraph pipeline — wired into /complaints/analyze
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
| VISION_MODEL           | Qwen/Qwen2.5-VL-72B-Instruct              | Vision model override (e.g. the 7B for faster demos) |
| ROUTING_MODEL          | Qwen/Qwen2.5-7B-Instruct                  | Model used by the Routing Agent |
| WARD_MODEL             | Qwen/Qwen2.5-7B-Instruct                  | Model used by the Location Agent; empty = parser-only fallback |
| SUPABASE_URL           | (empty)                                   | Supabase project URL — required for database calls |
| SUPABASE_ANON_KEY      | (empty)                                   | Supabase anon key — required for database calls |
| SUPABASE_STORAGE_BUCKET | complaint-photos                          | Public Storage bucket for complaint photos (created by schema.sql) |

The app boots without `FEATHERLESS_API_KEY`; `POST /complaints/analyze`
answers **502** with a clear message until the key is set (locally in
`backend/.env`, or as a Vercel environment variable in production).
Similarly, database calls fail with a clear message until `SUPABASE_URL` +
`SUPABASE_ANON_KEY` are set and `supabase/schema.sql` has been run once.
The schema also creates the public `complaint-photos` Storage bucket and its
demo upload/read policies — run it again (or just the storage section) when
enabling photo uploads.

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
