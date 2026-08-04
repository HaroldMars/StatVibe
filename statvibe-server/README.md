# StatVibe Server

Backend API for the multi-project StatVibe architecture.

| | |
|---|---|
| Vercel project | `statvibe-server` |
| Root Directory | `statvibe-server` |
| URL | https://statvibe-server.vercel.app |

## CORS — trust `CLIENT_URL`

Set on Vercel:

```
CLIENT_URL=https://stat-vibe.vercel.app
DATABASE_URL=...   # or MONGO_URI
JWT_SECRET=...
```

`express-app.js` enables CORS dynamically:

```js
const allow = new Set([
  ...parseOriginList(process.env.CLIENT_URL),
  'https://stat-vibe.vercel.app',
  // + localhost + *.vercel.app previews
]);

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
```

All `/api/*` requests go through Express into the shared `requestHandler` in `server.js`.

## vercel.json

Catch-all routes to `api/index.js` (Express export) so REST paths work on Vercel serverless.

## Local

```bash
cd statvibe-server
cp .env.example .env
npm i
CLIENT_URL=http://localhost:5173 npm run dev:express
```
