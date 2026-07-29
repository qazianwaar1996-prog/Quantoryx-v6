# Railway deployment

This repository contains both the Quantoryx frontend and FastAPI backend. The
Railway service for the API must use the repository root as its service
**Root Directory**:

```text
/
```

Do not set the service Root Directory to `frontend/` or `backend/`. The root
contains the deployment files that make the API service unambiguous:

- `Dockerfile` builds the Python backend image.
- `railway.json` selects the Dockerfile builder and starts `uvicorn main:app`.
- `Procfile` provides the same Uvicorn command as a fallback.
- `main.py` is a root entrypoint that exposes the existing
  `backend.backend.main:app` application without moving backend code.

Railway service settings:

| Setting | Value |
| --- | --- |
| Root Directory | `/` |
| Builder | Dockerfile |
| Build Command | Leave empty; the Dockerfile installs `backend/requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}` |
| Healthcheck Path | `/docs` |

After changing the service Root Directory, trigger a fresh deployment. The
expected API checks are:

```text
GET /docs         → 200
GET /openapi.json → 200
GET /api/health   → 200
```