# Quantoryx v6 — Deployment

## 1. Build

```bash
npm install
npm run build:prod        # → dist/Quantoryx-v6-Production.html
```

The production target differs from dev in three ways:

| | dev | prod |
|---|---|---|
| JSX | compiled in-browser by babel-standalone | **precompiled at build time** |
| babel-standalone (~2.7 MB) | loaded from CDN | **removed** |
| CSS | readable | minified |
| Time to interactive | ~2.9 s | **~0.28 s** |

## 2. Backend

```bash
cd <backend-repo>
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

# Pin these two — the code targets Pydantic v1:
.venv/bin/pip install "fastapi==0.103.2" "pydantic==1.10.26" email-validator

export QUANTORYX_SECRET_KEY="$(openssl rand -hex 32)"     # REQUIRED in production
export QUANTORYX_DATABASE_URL="postgresql://user:pass@host/quantoryx"

.venv/bin/uvicorn backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Optimization and walk-forward are dispatched to Celery and need Redis:

```bash
redis-server &
export QUANTORYX_REDIS_BROKER_URL=redis://localhost:6379/0
export QUANTORYX_REDIS_BACKEND_URL=redis://localhost:6379/1
celery -A backend.tasks.celery_app worker --loglevel=info
```

Without Redis the platform still runs — those two pages show a clear
"task queue unavailable" state with the exact commands to fix it.

## 3. Serve

Copy `dist/Quantoryx-v6-Production.html` to `/var/www/quantoryx/` and use
`deploy/nginx.conf`. It serves the SPA and proxies `/api` (HTTP **and**
WebSocket upgrade) to `127.0.0.1:8000`, so everything is same-origin.

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/quantoryx
sudo ln -s /etc/nginx/sites-available/quantoryx /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Runtime configuration

The SPA reads optional globals before boot — no rebuild needed to repoint it:

```html
<script>
  window.QX_API_BASE = '/api';          // or 'https://api.quantoryx.io/api'
  window.QX_WS_BASE  = '';              // defaults to the current origin
  window.QX_LOG_LEVEL = 'warn';         // debug | info | warn | error | silent
</script>
```

## 5. Pre-launch checklist

- [ ] `QUANTORYX_SECRET_KEY` set to a strong random value (JWTs are signed with it)
- [ ] TLS terminated; uncomment the HSTS header and the port-80 redirect
- [ ] Postgres instead of the default SQLite file
- [ ] Redis + Celery worker running (enables Optimize / Walk-Forward)
- [ ] `npm test` green against the production bundle
- [ ] Backend CORS tightened — `backend/main.py` currently uses `allow_origins=["*"]`,
      which is safe only because nginx makes the app same-origin. Restrict it if the
      API is ever exposed directly to browsers.
- [ ] Attach a real log sink: `log.setReporter(e => fetch('/api/logs',{method:'POST',...}))`

## 6. Known backend gaps

These are **backend** work items; the frontend already handles each one gracefully.

| Area | Status |
|---|---|
| `POST /api/paper-trading` | 500 — `KeyError: 'drawdown_pct'` in the service layer |
| `POST /api/optimize`, `/api/walk-forward` | require Redis + Celery |
| `POST /api/auth/forgot` | not implemented — UI falls back to a generic success message |
| alerts · journal · signals · billing · builder | no routes yet — UI runs on local fixtures and is labelled "Sample data" |
| `GET /api/system-health` | admin-only; non-admins see a clear explanation |
