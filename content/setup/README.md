# Setup

## Local API + SPA

```bash
cp .env.example .env
# Set MONGO_URI (or KV) for durable accounts
npm install
npm run dev:server   # API :4173
# optional: npm run dev for Vite client
```

## Monorepo packages

| Package | Command | Port / host |
|---------|---------|-------------|
| `statvibe-server` | `npm start` / Vercel | API |
| `statvibe-client` | Vite / Vercel static | App |
| `statvibe-landing` | `npm run dev` | Landing |
| `statvibe-admin` | `npm run dev` | Admin Next |

## Billing (optional)

```bash
PAYMONGO_SECRET_KEY=sk_test_...
PAYMONGO_WEBHOOK_SECRET=whsec_...
USD_PHP_RATE=56
CLIENT_URL=https://stat-vibe.vercel.app
```

Webhook guide: `/docs/paymongo-webhooks.md`

## Admin Next → live API pricing

```bash
STATVIBE_API_URL=https://statvibe-server.vercel.app
STATVIBE_ADMIN_USER=GenAdmin
STATVIBE_ADMIN_PASSWORD=...
```

## Marketing video render

```bash
cd content/marketing/video
npm install playwright@1.49.0
npx playwright install chromium
node render-ad.mjs
# Output: content/marketing/video/out/statvibe-ad.mp4
```
