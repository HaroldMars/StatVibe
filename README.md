# StatVibe

> **Multi-project layout:** see [`MONOREPO.md`](./MONOREPO.md) for `statvibe-server` / `statvibe-client` / `statvibe-landing` / `statvibe-admin` Vercel Root Directories.

A worldwide-class business application — run the whole business from one screen.
Real-time analytics, a business calculator, an idea & project hub, a multi-model AI
workspace, and the **AgentTech** client-messaging assistant. Built for teams of any
size, in any industry.

Implemented from the Claude Design project **“Global Business Application Design”**
(`Business App.dc.html`) and updated to a playful, mobile-first UI direction with
rounded surfaces, brighter gradients, and install-ready app icon assets.

> A new, upcoming project of **Illuminary Peak Company · 2026**.

---

## Quick start

```bash
npm run dev          # Vite dev server + local /api middleware
```

For a production-like local run:

```bash
npm run build
npm start            # serves dist/ when present, else public/
```

Backend-only mode is still available:

```bash
npm run dev:server   # zero-dependency Node server on :4173
```

## AI integration (local or hosted)

AI features call either local **[Ollama](https://ollama.com)** or a hosted
OpenAI-compatible API (OpenRouter, Groq, Together, OpenAI, etc.) through the
same server proxy endpoint: `/api/chat`.

```bash
ollama pull gemma2   # or llama3.1, mistral, qwen2.5 …  (once)
ollama serve         # usually already running
```

- **Models you've pulled** appear as active engines in the AI Workspace and power the
  AI Workspace, Calculator, Idea Hub and AgentTech drafts.
- **Cloud models** (Claude, GPT-4o, Gemini, Grok) are shown but marked **“Not available
  yet.”** An admin can flip any of them to *available* from the console (they then run
  through the simulator, clearly labelled).
- **Hosted fallback:** set `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL` to keep AI live
  for users who do not run local Ollama.
- **No Ollama + no hosted key?** The app still works fully — it falls back to a
  built-in simulated responder. Point at another host with
  `OLLAMA_HOST=http://host:11434`.

## Accounts (beta)

Real accounts with a backend + secure auth:

- **Try as guest** — use the whole app before signing up (guest data is disposable).
- **Register / Login** — email + password (scrypt-hashed, never stored or returned in
  plaintext), **Terms & Privacy** acceptance required, 30-day bearer sessions.
- **Blank on register → setup wizard** — name your business, pick an industry, **currency**
  (USD/PHP/EUR/CNY/SGD/…), team size and goals. Everything downstream uses your currency.
- **Privacy & Security** (Settings) — change password, export data, your **StatVibe QR tag**,
  payment method (PayMongo QR — demo), and **delete account** (removes all your data).

**Smart inventory** (Calculator → Supply): add products with stock, price, cost, quantity,
size, weight and a daily **sales/consumption rate**; StatVibe's AI predicts **how many days
each item lasts** and gives a one-line reorder recommendation.

The backend runs locally on a JSON store today and swaps to Postgres/Supabase for production —
see [ROADMAP.md](ROADMAP.md) for the Vercel + Ollama-server + PayMongo plan.

## Features (every button is wired)

| Area | Screens | Notable behaviour |
|------|---------|-------------------|
| Onboarding | Welcome, Register, Login, Setup | Guest mode, T&C, blank account → business setup wizard |
| **Statistics dashboard** | Stats | Revenue trend, KPI chips, predictive insight, channel mix, drill-down → Revenue detail |
| **Business calculator** | Calc | Live pricing/margin math, supply tracker, Retail/Product/Supply, "Ask AI to optimize" |
| **Idea & project hub** | Hub | Project cards, create idea, per-idea AI next-steps |
| **AI workspace** | AI | Toggle/blend models, run prompt or template → generated document w/ attribution, Refine/Copy/Export |
| **AgentTech assistant** | Agent | Client chat; AI drafts a reply **once**; Approve / Edit / send |
| **Subscription model** | Plans | Free-tier usage meter; Free/Pro/Business/Enterprise upgrades |
| Alerts, Settings & Profile | Alerts, Settings, Profile | Alerts; workspace/plan/model settings; editable profile; sign out |
| **Admin / Developer** | Admin | Full-access console — see below |

Bottom tab bar switches the five core areas; sub-screens use a back stack.
**Deep links:** `#stats #calc #hub #ai #agent #plans #settings #profile #alerts #revenue #admin`.

## Appearance (Light / Dark / System)

Settings → Appearance offers **Light**, **Dark**, and **System (Default)** — System follows
the device's `prefers-color-scheme` and updates live when it changes. The choice persists
across sessions. Theming is driven by CSS variables (`:root[data-theme="dark"]`).

## Developer console — a separate app at `/admin`

The admin area is **not** part of the consumer app. It's a standalone page served at
**`/admin`** that only developers can sign in to, with **real username + password accounts**:

- The **first "founder" account** (e.g. the CEO) is seeded on first boot from
  `ADMIN_USER` / `ADMIN_PASSWORD` in `.env`. Default dev login: **GenAdmin** /
  `genadmin-2026`.
- The founder can **create and remove additional developer accounts** from the console.
- Provides live **system health**, **AI engine flags** (force-simulate, blend default),
  **cloud-model availability toggles**, **metrics**, a **raw AI test console**, and the
  **server log**.

Backed by: `POST /api/admin/login` (username+password → admin session), and token-gated
`GET /api/admin/summary`, `POST /api/admin/config|reset`, `GET/POST /api/admin/accounts`
(founder only). A static `ADMIN_TOKEN` is also accepted for automation. Config persists to
`data/config.json`; admin accounts to `data/db.json`.

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Liveness/readiness — status, version, uptime, Ollama state |
| `GET /api/meta` | Supported currencies |
| `GET /api/models` | Available engines + cloud models (with availability) |
| `POST /api/chat` | `{ model?, messages[] }` → AI completion (Ollama or simulated) |
| `POST /api/auth/register\|login\|guest\|logout\|change-password`, `GET /api/auth/me` | Auth |
| `GET/POST/PATCH/DELETE /api/account`, `POST /api/account/setup` | Account + business setup *(auth)* |
| `GET/POST /api/inventory`, `PATCH/DELETE /api/inventory/:id` | Inventory CRUD *(auth)* |
| `POST /api/predict` | `{ itemId }` → days-to-last + AI reorder note *(auth)* |
| `GET /api/admin/summary` | System + metrics + config *(token)* |
| `POST /api/admin/config` | Update feature flags / cloud availability *(token)* |
| `POST /api/admin/reset` | Reset config to defaults *(token)* |

## Configuration (env vars)

| Var | Default | Purpose |
|-----|---------|---------|
| `PORT` | `4173` | Listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama instance to proxy |
| `ADMIN_USER` | `GenAdmin` | Founder developer username (seeded at `/admin`) |
| `ADMIN_PASSWORD` | `genadmin-2026` | **Change in production** — founder password for `/admin` |
| `ADMIN_TOKEN` | `genadmin-2026` | Static admin token for automation (`x-admin-token`) |

The server **auto-loads `.env`** at startup (real environment variables take
precedence). Copy `.env.example` → `.env`; `.env` is gitignored, so dev secrets never
get committed.

## Testing

```bash
npm test     # API + server tests (Node built-in runner, deterministic, no deps)
npm run smoke  # browser end-to-end smoke via headless Chrome (skips if none found)
```

- `test/api.test.js` — 15 tests: health, static/SPA routing, models, chat + fallback,
  admin auth & config, security headers, body-size cap.
- `test/smoke.mjs` — drives the real UI: onboarding → dashboard, all five tabs, live
  calculator math, AgentTech draft-once, AI document generation, admin unlock, and
  asserts **no uncaught JS errors**.

## Deployment

### Vercel (recommended, Vite + serverless API)

The repo is Vercel-ready with a Vite static build (`dist/`) plus a serverless API:
`/api/*` routes to `api/index.js` (which wraps the shared handler in `server.js`).

1. Import the repo in Vercel (no build command needed).
2. **Add durable storage:** Vercel → **Storage → KV** → *Create* and connect it. That
   injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`, and the store uses KV automatically.
   *(Without KV, Vercel writes to `/tmp`, which is ephemeral — accounts disappear on cold
   starts. KV takes ~1 minute to add and makes data durable.)*
3. **Set env vars** (Settings → Environment Variables): `ADMIN_USER`, `ADMIN_PASSWORD`,
   `ADMIN_TOKEN`, `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`, and optionally `OLLAMA_HOST`
   (a **public** Ollama server — local Ollama is unreachable from Vercel), plus
   `PAYMONGO_SECRET_KEY` for live payments.
4. Deploy. `/` is the app, `/admin` is the developer console.

> Serverless is stateless and per-instance, so the KV store is last-write-wins across
> concurrent instances — fine for alpha. For high scale, swap in Postgres (same store
> interface). Tested: the exported handler runs under a serverless invocation, seeds the
> founder on cold start, and KV persistence survives cold starts.

**Docker**
```bash
docker build -t statvibe .
docker run -p 4173:4173 -e ADMIN_TOKEN=$(openssl rand -hex 16) \
  -e OLLAMA_HOST=http://host.docker.internal:11434 statvibe
```
The image includes a `HEALTHCHECK` hitting `/api/health`.

**PaaS (Heroku/Railway/Render/Fly)** — a `Procfile` (`web: node server.js`) is included;
set `PORT` (most platforms inject it), `ADMIN_TOKEN`, and `OLLAMA_HOST`.

**Bare metal / systemd / pm2** — `node server.js`. The process handles `SIGTERM`/`SIGINT`
for graceful shutdown. Security headers (CSP, nosniff, frame options) are sent on every
response; static assets are cached, HTML is not.

## Project layout

```
server.js            Zero-dep server: static + Ollama proxy + auth/account/inventory + admin
lib/
  store.js           Data store interface (JSON dev store; Postgres adapter for prod)
  auth.js            Password hashing (scrypt) + tokens + validation
public/
  index.html         App shell + iPhone frame + desktop side panel
  styles.css         Mobile-first design system (playful app-style theme)
  app.js             Consumer SPA: state, router, auth/setup/inventory, theming, all screens
  admin.html/admin.js  Separate developer console served at /admin
  logo.svg           StatVibe logo (used as app icon & favicon)
test/
  api.test.js        30 server/API tests (npm test)
  smoke.mjs          10 headless-Chrome UI checks (npm run smoke)
data/                Local JSON store (gitignored)
Dockerfile · Procfile · .env.example · package.json · ROADMAP.md
```

> **Vercel-ready:** `vercel.json` + `api/index.js` are included and tested. Add Vercel KV
> for durable storage (see the Vercel section above). The same `server.js` also runs as a
> standalone process for local/VPS/Docker.

## Notes

- Auth, payments and third-party integrations are simulated. AI output is real (from your
  local model) when Ollama is running. `data/` (persisted admin config) is gitignored.
- **Logo/App icon:** app icon assets are served from `public/logo.svg`,
  `public/icon-192.png`, `public/icon-512.png`, and `public/apple-touch-icon.png`.
