# StatVibe Landing

Marketing site for the multi-project StatVibe architecture.

| | |
|---|---|
| Vercel project | `statvibe-landing` |
| Root Directory | `statvibe-landing` |
| URL | https://statvibe-landing.vercel.app |

## Env

```bash
NEXT_PUBLIC_CLIENT_URL=https://stat-vibe.vercel.app
# Optional:
# NEXT_PUBLIC_API_URL=https://statvibe-server.vercel.app
# NEXT_PUBLIC_IOS_STORE_URL=
# NEXT_PUBLIC_ANDROID_STORE_URL=
```

## Device-aware CTAs

`useDeviceRedirect` reads `NEXT_PUBLIC_CLIENT_URL` and routes:

- **Mobile** — Launch / Get Started → live app (or App Store / Play when store URLs are set)
- **Desktop** — Launch → app home; Get Started / Sign up → `${CLIENT_URL}/signup`

## Local

```bash
cd statvibe-landing
cp .env.example .env.local
npm i
npm run dev
```
