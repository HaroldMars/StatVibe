# StatVibe — Multi-project Vercel architecture

Three Vercel projects from one monorepo:

| Package | Root Directory | Production URL | Role |
|---------|----------------|----------------|------|
| `statvibe-server/` | `statvibe-server` | https://statvibe-server.vercel.app | Express API, auth, durable store |
| `statvibe-client/` | `statvibe-client` | https://stat-vibe.vercel.app | Vite SPA (dashboard) |
| `statvibe-landing/` | `statvibe-landing` | https://statvibe-landing.vercel.app | Next.js marketing |

The repo root still contains the legacy combined SPA + API used by Illuminary Peak Hobby (`stat-vibe`) until Root Directories are switched per project.

## Environment matrix

### Server (`statvibe-server`)

```
DATABASE_URL=...          # or MONGO_URI
JWT_SECRET=...
CLIENT_URL=https://stat-vibe.vercel.app
```

### Client (`statvibe-client`)

```
NEXT_PUBLIC_API_URL=https://statvibe-server.vercel.app
VITE_API_URL=https://statvibe-server.vercel.app
```

### Landing (`statvibe-landing`)

```
NEXT_PUBLIC_CLIENT_URL=https://stat-vibe.vercel.app
```

## CORS strategy (server)

`statvibe-server/express-app.js` uses the `cors` package with a dynamic allowlist:

1. `CLIENT_URL` (comma-separated supported via `CLIENT_URLS`)
2. Hard defaults including `https://stat-vibe.vercel.app` and localhost
3. Any `*.vercel.app` preview origin

```js
app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
```

All `/api/*` traffic is forwarded to the shared `requestHandler` in `server.js`.

## vercel.json

- **Server** — Node serverless entry `api/index.js`, catch-all route to Express.
- **Client** — static build → `dist`, SPA fallback to `index.html`.
- **Landing** — Next.js framework defaults.

## Local

```bash
# API
cd statvibe-server && npm i && CLIENT_URL=http://localhost:5173 npm run dev:express

# Client (proxies /api in dev)
cd statvibe-client && npm i && NEXT_PUBLIC_API_URL=http://127.0.0.1:3000 npm run dev

# Landing
cd statvibe-landing && npm i && npm run dev
```
