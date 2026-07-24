# Quantoryx v6.0 — Frontend

Additive frontend layer over the existing **Quantoryx v5** platform.
The uploaded v5 files are treated as **read-only production source** and are never modified.

```
quantoryx/
├── build/
│   ├── build.js            # composes dist/ from base + src/ (applies build-time patches)
│   ├── verify.js           # static checks: JSX, identifier collisions, CSS, routing
│   └── smoke.js            # runtime checks in headless Chromium (all 15 routes)
├── src/
│   ├── styles/
│   │   └── extensions.css  # new component styles (v5 tokens only, never redefined)
│   ├── lib/
│   │   ├── utils.js        # formatters, fuzzy search, class helpers
│   │   ├── api.js          # ★ single backend seam — mock ⇄ live
│   │   └── hooks.js        # useAsync, useHotkeys, useDismiss, usePersisted, …
│   ├── components/
│   │   ├── Primitives.js   # Modal, Confirm, Toast, Skeleton, Drawer, Spinner
│   │   ├── CommandPalette.js
│   │   └── HeaderMenus.js  # notifications, profile, mobile "More"
│   ├── pages/
│   │   ├── AlertsPage.js   SignalsPage.js   BuilderPage.js
│   │   ├── JournalPage.js  BillingPage.js   HelpPage.js
│   │   └── ErrorPages.js   # 404, ErrorBoundary, ForgotPassword
│   └── app/
│       └── AppShell.js     # AppV6 root: routing, hotkeys, theme, overlays
└── dist/
    └── Quantoryx-v6-Complete.html   ← the deliverable (open directly)
```

## Commands

```bash
npm install
npm run build     # → dist/Quantoryx-v6-Complete.html
npm run verify    # static analysis
npm run smoke     # browser runtime test + screenshots
npm test          # all three
```

`dist/Quantoryx-v6-Complete.html` is a single self-contained file — open it in a browser,
no server required.

---

## Backend integration

Everything funnels through **`src/lib/api.js`**. Flip two constants:

```js
const API_MODE = 'live';      // was 'mock'
const API_BASE = '/api/v1';
```

No page or component changes are needed. Endpoints the backend must provide:

| Domain | Methods |
|---|---|
| `api.notifications` | `list` · `markRead` · `markAllRead` |
| `api.alerts` | `list` · `create` · `toggle` · `remove` |
| `api.signals` | `list` · `tickers` |
| `api.journal` | `list` · `create` · `remove` |
| `api.billing` | `plans` · `invoices` · `usage` · `subscribe` |
| `api.builder` | `blocks` · `save` |
| `api.help` | `faq` · `docs` · `shortcuts` |
| `api.auth` | `login` · `forgot` · `logout` |

`_http()` already handles JSON headers, non-2xx → `ApiError`, and body serialisation.
Live tick data should replace the simulated interval in `SignalsPage` with a WebSocket
subscription exposed from `api.signals`.

The v5 pages (Dashboard, Strategies, Backtest, Optimize, Portfolio, Reports, Regime,
AI Assistant) still read their original in-file mock constants — those are the next
candidates to route through `api.js`, and they were deliberately left untouched.

---

## Build-time patches

`build.js` repairs three **pre-existing defects** found in the v5 base while verifying.
They are applied to the output only; the source file on disk is never written to.

| Patch | Impact |
|---|---|
| `v5-settings-unterminated-string` | A stray apostrophe in `SettingsPage` (`gap:8'}}`) left a string unterminated. Babel compiles the whole `<script type="text/babel">` block as one unit, so this **prevented the entire app from compiling** — v5 rendered a blank page. |
| `recharts-missing-prop-types` | Recharts 2.8.0 UMD expects a global `PropTypes` that was never loaded, so `Recharts` stayed `undefined` and the top-level destructure threw. Loading `prop-types` first fixes it. |
| `v5-regime-startswith-on-number` | `RegimePage` called `.startsWith()` on `Occurrences` (a number), crashing the Market Regime page. Coerced with `String(v)`. |

A fourth fix — the mobile header logo overlapping "Markets Open" below 768px — is handled
purely in `extensions.css` and needs no patch.

If you later fix these in the v5 source itself, `build.js` will fail loudly
(`Patch "…" did not match`) so the patch list can be pruned.

---

## Conventions followed

- **Design tokens**: only v5 variables (`--bg-*`, `--tx-*`, `--pu-*`, `--bd-*`, `--sh-*`,
  `--r*`, `--t*`). No token is redefined, so `.lm` light mode applies to new pages for free.
- **Style**: compact arrow components, `const X=({a,b})=>(…)`, box-drawing section banners,
  same 2-space indentation and naming as v5.
- **No duplication**: v5's `PageHd`, `Empty`, `Toggle`, `MiniLine`, `Spark`, `ChartTip`,
  `PageWrap`, `Login` and all nine v5 pages are reused verbatim.
- **Namespacing**: new shell components are suffixed `V6` (`HeaderV6`, `SidebarV6`) so the
  v5 originals remain declared and collision-free in the shared Babel scope.
