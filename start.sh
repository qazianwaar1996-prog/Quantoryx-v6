#!/usr/bin/env bash
# ══════════════════════════════════════════════
#  Quantoryx v6.0 — one-command local start
#  Boots the FastAPI backend and the SPA dev server together.
#  Usage:  ./start.sh          (production bundle, port 4174)
#          ./start.sh --dev    (readable bundle,   port 4173)
# ══════════════════════════════════════════════
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
API_PORT=8000

MODE="prod"; WEB_PORT=4174
[[ "${1:-}" == "--dev" ]] && { MODE="dev"; WEB_PORT=4173; }

say(){ printf '\033[1;35m▶\033[0m %s\n' "$1"; }
die(){ printf '\033[1;31m✗\033[0m %s\n' "$1" >&2; exit 1; }

command -v python3 >/dev/null || die "python3 is required"
command -v node    >/dev/null || die "node is required"

# ── Backend ───────────────────────────────────
say "Preparing backend…"
cd "$BACKEND"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
  # Pydantic v1 syntax in the codebase; modern FastAPI needs v2 and won't start.
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q -r requirements.txt
  .venv/bin/pip install -q "fastapi==0.103.2" "pydantic==1.10.26" email-validator
fi

: "${QUANTORYX_SECRET_KEY:=$(python3 -c 'import secrets;print(secrets.token_hex(32))')}"
export QUANTORYX_SECRET_KEY

say "Starting API on :$API_PORT"
.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port "$API_PORT" > "$BACKEND/uvicorn.log" 2>&1 &
API_PID=$!
trap 'kill $API_PID $WEB_PID 2>/dev/null || true' EXIT INT TERM

for i in $(seq 1 45); do
  curl -sf "http://127.0.0.1:$API_PORT/api/health" >/dev/null 2>&1 && break
  sleep 1
  [[ $i -eq 45 ]] && { tail -20 "$BACKEND/uvicorn.log"; die "API failed to start"; }
done
say "API healthy"

# ── Frontend ──────────────────────────────────
cd "$FRONTEND"
[[ -d node_modules ]] || { say "Installing frontend dependencies…"; npm install --silent; }

if [[ "$MODE" == "prod" ]]; then
  say "Building production bundle (precompiled JSX)…"
  npm run build:prod --silent
  export QX_TARGET=/Quantoryx-v6-Production.html
else
  say "Building development bundle…"
  npm run build --silent
fi

say "Serving UI on :$WEB_PORT  (proxying /api → :$API_PORT)"
node build/devserver.js "$WEB_PORT" "$API_PORT" &
WEB_PID=$!
sleep 2

printf '\n\033[1;32m✓ Quantoryx v6.0 is running\033[0m\n'
printf '   UI   http://127.0.0.1:%s\n' "$WEB_PORT"
printf '   API  http://127.0.0.1:%s/api/health\n' "$API_PORT"
printf '   Docs http://127.0.0.1:%s/docs\n\n' "$API_PORT"
printf 'Register a new account on first visit. Ctrl+C to stop.\n\n'

wait $WEB_PID
