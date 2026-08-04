# StatVibe Client

Mobile-first dashboard SPA (Vite). Deploy as Vercel project with **Root Directory** `statvibe-client` → https://stat-vibe.vercel.app

## Env

```
NEXT_PUBLIC_API_URL=https://statvibe-server.vercel.app
VITE_API_URL=https://statvibe-server.vercel.app
```

`public/js/api.js` uses these for absolute `/api` calls when the API is on a separate origin. Leave empty for same-origin / Vite proxy.

## Local

```bash
npm i
NEXT_PUBLIC_API_URL=http://127.0.0.1:3000 npm run dev
```
