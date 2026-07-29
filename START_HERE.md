# Quantoryx v6.0 — Complete Platform

Frontend **and** backend, fully integrated and verified together.
Every page reads live data from the API. There are no mock data sources left.

```
Quantoryx-v6-Full/
├── frontend/            React SPA (build system, tests, deploy config)
├── backend/             FastAPI + SQLAlchemy + Celery
├── original-uploads/    the 4 HTML files and 2 PNGs you supplied, unmodified
└── START_HERE.md        this file
```

---

## Run it (two terminals)

### 1 — Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# The code targets Pydantic v1. Modern FastAPI requires v2 and will not start,
# so pin these three:
.venv/bin/pip install "fastapi==0.103.2" "pydantic==1.10.26" email-validator

export QUANTORYX_SECRET_KEY="$(openssl rand -hex 32)"
.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

The SQLite database and its schema are created automatically on first boot.

### 2 — Frontend

```bash
cd frontend
npm install
npm run build:prod        # → dist/Quantoryx-v6-Production.html
npm run serve:prod        # http://127.0.0.1:4174
```

`serve:prod` also proxies `/api` (HTTP **and** WebSocket) to `127.0.0.1:8000`,
so the app runs same-origin with no CORS configuration.

Open **http://127.0.0.1:4174**, click **Register**, and you are in.

---

## What is wired

**53 API routes.** Every screen below reads and writes the real backend.

| Page | Endpoints |
|---|---|
| Auth | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `/auth/forgot` · `GET /auth/me` |
| Dashboard | `GET /dashboard` · `/portfolio` · `/strategies` · `/market-regime` |
| Strategies | `GET /strategies` |
| Backtest | `POST /backtest` |
| Optimize | `POST /optimize` · `/walk-forward` · `GET /tasks/{id}` |
| AI Assistant | `POST /ai-analysis` |
| Portfolio | `GET /portfolio` · `/portfolio/holdings` |
| Reports | `GET /reports` |
| Market Regime | `GET /market-regime` |
| **Alerts** | `GET/POST /alerts` · `PATCH/DELETE /alerts/{id}` |
| **Trade Journal** | `GET/POST /journal` · `DELETE /journal/{id}` |
| **Live Signals** | `GET /signals` · `/market/tickers` |
| **Billing** | `GET /billing/plans|invoices|usage` · `POST /billing/subscribe` |
| **Builder** | `GET /builder/blocks` · `POST /builder/strategies` |
| **Help** | `GET /help/faq` · `/help/docs` |
| Settings | `GET/PUT /portfolio/settings` · `PUT /auth/profile` · `POST /auth/change-password` |
| Real-time | `WS /ws/{user_id}?token=…` |

Bold rows are new in this pass — they previously ran on local fixtures.

---

## Verify it yourself

```bash
# Backend — 63 tests
cd backend
QUANTORYX_SECRET_KEY=test-key-at-least-32-bytes-long-here \
  .venv/bin/python -m pytest tests/ -q -p no:warnings

# Frontend — build, static analysis, offline resilience
cd frontend && npm test

# Full stack — requires both servers running
npm run e2e          # 13 sections, every endpoint
npm run a11y         # 5 breakpoints, keyboard, WCAG AA
```

---

## Optional: unlock Optimize and Walk-Forward

Those two dispatch to Celery and need Redis. Without it the platform runs fine
and those pages explain exactly what to start.

```bash
redis-server &
export QUANTORYX_REDIS_BROKER_URL=redis://localhost:6379/0
export QUANTORYX_REDIS_BACKEND_URL=redis://localhost:6379/1
celery -A backend.tasks.celery_app worker --loglevel=info
```

---

## Production deployment

See `frontend/deploy/README.md` and `frontend/deploy/nginx.conf` (TLS, CSP,
security headers, WebSocket upgrade, Postgres).

Full engineering detail — every bug fixed, benchmark, and security note — is in
`frontend/PRODUCTION_READINESS.md`.

---

## A note on `original-uploads/`

Your four HTML files and two PNGs are included byte-for-byte, untouched.
`Quantoryx-v5-Complete.html` still checksums `54d5c16394e4eb394d72788163cfa699`.
The frontend build reads a copy read-only and repairs three defects in it at
build time; the source file is never written to.
