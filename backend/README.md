# CivicFix Backend

FastAPI service for CivicFix Hyderabad. Right now it exposes a health check
plus placeholder routes; every AI / database module is empty scaffolding that
will be implemented in later milestones.

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

| Method | Path         | Description                                                  |
| ------ | ------------ | ------------------------------------------------------------ |
| GET    | /health      | Liveness check → `{"status": "ok", "service": "civicfix-backend"}` |
| GET    | /complaints  | Placeholder → `[]` (complaints arrive with the database milestone) |
| GET    | /docs        | Swagger UI for trying endpoints in the browser               |

## Structure

```
backend/
├── app/
│   ├── main.py               # FastAPI app: CORS + registers routers
│   ├── config.py             # Central settings (reads .env automatically)
│   ├── routes/               # One router module per resource
│   │   ├── health.py         # GET /health
│   │   └── complaints.py     # GET /complaints (placeholder)
│   ├── agents/               # Future AI agents — stubs only, no logic yet
│   │   ├── vision_agent.py   #   photo analysis (what is the issue?)
│   │   ├── location_agent.py #   where is it? (coords / ward)
│   │   ├── routing_agent.py  #   which department handles it?
│   │   ├── complaint_agent.py#   assemble + validate a complaint record
│   │   └── tracking_agent.py #   tracking IDs + status updates
│   ├── services/             # Future integrations — stubs only
│   │   ├── featherless_service.py  # Featherless AI calls
│   │   ├── supabase_service.py     # Supabase database calls
│   │   └── storage_service.py      # photo storage (Supabase Storage)
│   ├── schemas/              # Future request/response Pydantic models
│   │   └── complaint_schema.py
│   └── workflows/            # Future LangGraph pipeline — stub only
│       └── complaint_workflow.py
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

## Testing the API

With the server running:

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"civicfix-backend"}

curl http://localhost:8000/complaints
# []
```

Or open http://localhost:8000/docs and press "Try it out".
