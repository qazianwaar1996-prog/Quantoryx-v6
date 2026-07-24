# Backend Integration Map — v6 frontend ⇄ Quantoryx FastAPI

Backend: `github.com/qazianwaar1996-prog/Quantoryx` (public, read via unauthenticated
GitHub API). FastAPI, all routers mounted under **`/api`**, CORS `allow_origins=["*"]`.

> ⚠️ **`API_BASE` must be `/api`, not `/api/v1`.** The current default in `src/lib/api.js`
> would 404 against this backend.

---

## 1. Endpoints that already line up

| Frontend call | Backend route | Status |
|---|---|---|
| `api.auth.login` | `POST /api/auth/login` | ✅ exists — see §3, shape differs |
| `api.auth.logout` | `POST /api/auth/logout` | ✅ needs `{refresh_token}` in body |
| `api.notifications.list` | `GET /api/portfolio/notifications` | ✅ path differs |
| `api.notifications.markRead` | `PUT /api/portfolio/notifications/{id}/read` | ✅ `PUT`, not `POST` |
| `api.notifications.markAllRead` | `PUT /api/portfolio/notifications/read-all` | ✅ `PUT`, not `POST` |

Backend endpoints the v5 pages should eventually use (they still hold in-file mocks):
`GET /api/dashboard`, `/api/portfolio`, `/api/strategies`, `/api/reports`,
`/api/market-regime`, `POST /api/backtest`, `/api/optimize`, `/api/walk-forward`,
`/api/ai-analysis`, `/api/paper-trading`, plus `GET /api/tasks/{task_id}` for polling
long-running jobs.

## 2. Frontend domains with **no** backend route yet

These are the gaps to close on the backend side — the UI is built and waiting:

| Domain | Needed routes |
|---|---|
| `api.alerts` | `GET/POST /api/alerts`, `PATCH /api/alerts/{id}`, `DELETE /api/alerts/{id}` |
| `api.signals` | `GET /api/signals`, `GET /api/market/tickers` (or stream over WS) |
| `api.journal` | `GET/POST /api/journal`, `DELETE /api/journal/{id}` |
| `api.billing` | `GET /api/billing/plans|invoices|usage`, `POST /api/billing/subscribe` |
| `api.builder` | `GET /api/builder/blocks`, `POST /api/builder/strategies` |
| `api.help` | `GET /api/help/faq|docs` (or keep static on the client) |
| `api.auth.forgot` | `POST /api/auth/forgot` — **not implemented**; backend has `change-password` only |

Partial matches worth reusing: `GET /api/portfolio/holdings`, `/api/portfolio/settings`,
`/api/portfolio/watchlists` (watchlists map nicely onto the Signals "Market Watch" panel).

## 3. Auth — the one real mismatch

Backend `POST /api/auth/login` takes `UserLoginRequest{username, password}` and returns:

```json
{ "access_token": "...", "refresh_token": "...", "token_type": "bearer" }
```

Note it returns **no user object** — the frontend must follow up with `GET /api/auth/me`
(returns `{id, username, email, full_name, role, is_active, created_at}`).
Every protected call needs `Authorization: Bearer <access_token>`, and
`POST /api/auth/refresh` rotates the pair when the access token expires.

Required change in `src/lib/api.js` — inject the token and handle the two-step login:

```js
let _token=null;
const setToken=t=>{ _token=t; try{localStorage.setItem('qx.token',t||'')}catch{} };

const _http=async(path,opts={})=>{
  const res=await fetch(`${API_BASE}${path}`,{
    headers:{'Content-Type':'application/json',
             ...(_token?{Authorization:`Bearer ${_token}`}:{}),
             ...(opts.headers||{})},
    ...opts,
    body:opts.body?JSON.stringify(opts.body):undefined,
  });
  if(res.status===401){ /* try refresh, else bounce to login */ }
  if(!res.ok) throw new ApiError(res.status,await res.text());
  return res.json();
};

api.auth.login = async ({u,p})=>{
  const tok=await _http('/auth/login',{method:'POST',body:{username:u,password:p}});
  setToken(tok.access_token);
  const user=await _http('/auth/me');
  return {token:tok.access_token,refresh:tok.refresh_token,user};
};
```

`AppShell.js` already stores whatever `onLogin` receives, so only `api.js` changes.

## 4. WebSocket — live signals

`WS /api/ws/{user_id}`; server replies `PONG` to a `ping` text frame and can `broadcast`.
Replace the simulated `useInterval` tick loop in `SignalsPage.js`:

```js
const ws=new WebSocket(`${WS_BASE}/api/ws/${userId}`);
ws.onmessage=e=>{ const m=JSON.parse(e.data); if(m.type==='TICK') setTicks(...); };
const hb=setInterval(()=>ws.readyState===1&&ws.send('ping'),25000);
```

Keep the heartbeat — the handler explicitly expects it.

## 5. Field-shape adapters

Backend is `snake_case` + UUID strings; the frontend uses `camelCase` + numeric ids and
epoch millis. Normalise at the `api.js` boundary so no page needs touching, e.g.
notifications: `is_read → read`, `created_at (ISO) → time (epoch ms)`,
`message → body`, `id (uuid) → id`.

## 6. Suggested order

1. Set `API_BASE='/api'`, add bearer-token plumbing + `/auth/me` (§3).
2. Point notifications at `/api/portfolio/notifications` with the §5 adapter.
3. Move the v5 pages onto `/api/dashboard|portfolio|strategies|reports|market-regime`.
4. Wire `POST /api/backtest|optimize` + `GET /api/tasks/{id}` polling.
5. Build the missing domains in §2 (alerts, journal, signals, billing, builder).
6. Swap the Signals tick loop to the WebSocket (§4).

Until step 1 lands, leave `API_MODE='mock'` — the UI is fully functional against mocks.
