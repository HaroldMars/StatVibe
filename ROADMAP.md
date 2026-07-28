# StatVibe — build roadmap

Turning the prototype into a real, deployable multi-user SaaS. This tracks what's
**done** and what's **next**, with the concrete architecture decisions you chose.

## Target production architecture

| Concern | Choice | Notes |
|---------|--------|-------|
| Frontend | Static SPA (`public/`) | Deploys anywhere, incl. Vercel static hosting |
| Backend | Node API (`server.js` locally → Vercel serverless functions) | Same handlers, different entrypoint |
| Database | JSON store now (`lib/store.js`) → **Postgres/Supabase** in prod | `DATABASE_URL` selects the adapter (Phase 2) |
| AI (Llama) | Local Ollama now → **Ollama on an always-on server** in prod | `OLLAMA_HOST` points Vercel at that server |
| Payments | **PayMongo** QR (QRPh) | Secret key + webhook live only on the server |
| Realtime chat | Polling → Supabase Realtime / Pusher | Vercel can't hold websockets |

> Secrets (DB URL, PayMongo secret, Ollama server URL, `ADMIN_TOKEN`) live only in
> server env / `.env` (gitignored). Never in the client.

---

## ✅ Phase 1 — Accounts + business setup + smart inventory (DONE)

- **Auth backend** (`lib/auth.js`, `lib/store.js`, `server.js`): register / login / **guest**,
  scrypt-hashed passwords, bearer sessions (30-day), change-password, delete-account.
  Passwords/hashes never leave the server.
- **Guest mode**: try the whole app before registering; guest data is separate and disposable.
- **Terms & Privacy**: acceptance required at register; readable in-app.
- **Blank account on register** → **business setup wizard** (name, industry, currency, team, goals).
- **Multi-currency** (USD, PHP, EUR, GBP, CNY, JPY, SGD, AUD, CAD, INR, AED, MYR) applied
  to all money formatting; changeable in Settings.
- **Smart inventory**: multiple items with stock, price, cost, quantity, size, weight, unit,
  and a daily **sales/consumption rate** → **AI predicts days-to-last** (`/api/predict`,
  computed math + a one-line Llama reorder recommendation).
- **Privacy & Security settings**: change password, active sessions, export data, **My QR tag**,
  payment method (PayMongo QR — demo), **delete account**.
- **Tests**: 30 API tests + 10 browser (Playwright-free, headless-Chrome) checks — all green.

## ✅ Alpha additions (DONE)

- **Bug fixes:** calculator **"+" now adds a product** (was resetting); product add hardened.
- **Currency everywhere:** all money fields format with the account currency (Settings → Currency).
- **Predictive analytics:** depletion shown in **days / weeks / months** with an AI reorder note.
- **Idea Hub:** ideas **persist** and are fully **editable** (title, notes, status) + delete; per-idea AI next-steps.
- **AIVibe:** describe a rough idea → AI reformulates it into a sharp, reusable prompt.
- **AI Workspace history:** every query/output is saved and reviewable (open, clear).
- **AgentTech:** **auto-reply vs approval** toggle (auto-reply sends in real time), unread **chat badge** on the tab, and an **empty state** when there are no messages.
- **Admin dashboard:** **registered users** table (name, email, business, currency, items, joined), **active users** (24h/7d), and **AI token consumption** total + per model (prompt/completion).
- **PWA install:** manifest + service worker → installable on iOS/Android ("Add to Home Screen"), offline app shell.
- **PayMongo endpoint** (`POST /api/pay/qr`): creates a real QRPh source when `PAYMONGO_SECRET_KEY` is set; otherwise returns a clear "not configured" message and the demo QR.

### ⏳ Alpha items still requiring your external accounts/keys
| Item | What's needed | Status |
|------|---------------|--------|
| **Live PayMongo charges** | `PAYMONGO_SECRET_KEY` + webhook endpoint | Endpoint built; add key to go live |
| **Google login** | Google OAuth `GOOGLE_CLIENT_ID` + consent screen | Deferred (needs your OAuth app) |
| **OTP verification** | Email/SMS provider (e.g. Resend/Twilio) | Deferred; dev flow can be added that shows the code locally |
| **Signed APK (iOS/Android)** | Capacitor/Cordova wrapper + Android build + signing (and Apple needs the App Store for a real `.ipa`) | PWA install shipped now; native APK is a build step |
| **Fully data-driven Stats** | user revenue baseline + sales history | Partially — inventory feeds it; full financials are Phase 5 |

## 🔜 Phase 2 — Real deployment (Vercel + Postgres + Ollama server)

1. **Postgres store** — add `lib/store.postgres.js` implementing the same interface using
   `DATABASE_URL` (Supabase/Neon/Vercel Postgres). Tables: `users, sessions, accounts,
   inventory`. Select adapter in `lib/store.js` when `DATABASE_URL` is set.
2. **Serverless entry** — add `api/[...path].js` that imports the existing handlers, plus
   `vercel.json` (static `public/` + rewrite `/api/*` → the function). No handler rewrites.
3. **Ollama server** — stand up Ollama on a VPS/GPU host; set `OLLAMA_HOST` in Vercel env.
4. **Env in Vercel**: `DATABASE_URL`, `OLLAMA_HOST`, `ADMIN_TOKEN`, `ADMIN_USER`,
   `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`.

## 🔜 Phase 3 — Payments (PayMongo, real)

- Serverless `POST /api/pay/qr` → create a PayMongo **QRPh** source/payment intent (secret key,
  server-side) → return the QR to the client (replaces the demo QR).
- `POST /api/pay/webhook` → verify PayMongo signature → activate/upgrade the subscription.
- Wire Plans upgrade + Settings → Payment method to the real flow.

## 🔜 Phase 4 — Cross-user chat by QR / email / number (Agent)

- `users.tag` (already issued, e.g. `SV-7F3K9Q`) is the shareable handle; **privacy: a user is
  only discoverable when they share their QR/tag** — no directory search.
- `POST /api/contacts/add {tag|email|phone}`, `conversations`, `messages` tables.
- Delivery via Supabase Realtime (or short-poll fallback on Vercel).
- **AgentTech auto-send**: per-conversation setting; AI drafts a reply tuned to the incoming
  message and either suggests (approve) or auto-sends based on the toggle.

## 🔜 Phase 5 — Stats & Hub fully data-driven

- **Stats**: after setup, ask a few business questions (revenue baseline, channels) and compute
  the dashboard from real sales + inventory instead of demo numbers; reflect calculator/inventory.
- **Hub**: persist ideas & notes to the account (`/api/ideas`), with the built-in AI assistant
  writing/expanding notes and suggesting next steps.

---

### Current status
Phase 1 is complete, tested, and runs locally with real Llama. Phases 2–5 are additive and
do not require rewriting Phase 1 — they swap the store adapter, add serverless entry, and add
endpoints. See `README.md` for run/test instructions.

Open http://localhost:4173/admin and sign in with GenAdmin / genadmin-2026
