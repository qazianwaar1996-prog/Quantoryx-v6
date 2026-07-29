---
name: Railway FastAPI deployment
description: Durable deployment constraint for the Quantoryx frontend/backend monorepo.
---

Railway must use the repository root (`/`) as the service Root Directory and an
explicit Docker/Uvicorn deployment. A root `index.html` can cause the platform
to select its static Caddy provider before the nested FastAPI app is considered.

**Why:** The repository contains both a frontend/static surface and a backend
under `backend/`; automatic detection served the static site and made
`/docs` and `/openapi.json` return 404.

**How to apply:** Keep the root `Dockerfile`, `main.py`, `railway.json`, and
`Procfile` aligned on `uvicorn main:app`; keep Railway Root Directory set to
`/`, leave the Docker build command empty, and use `/docs` as the health check.