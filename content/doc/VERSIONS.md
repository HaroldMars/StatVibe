# StatVibe versions

Last updated: 2026-08-08

## Current release

| Layer | Identifier |
|-------|------------|
| Product | **1.0.0-beta** |
| Server `VERSION` / health | `1.0.0` |
| Client / server package.json | `1.0.0` |
| Landing / Admin package.json | `0.1.0` |
| PWA service worker cache | **`statvibe-v41`** |

## Canonical URLs

| Surface | URL |
|---------|-----|
| App | https://stat-vibe.vercel.app |
| API | https://statvibe-server.vercel.app |
| Landing | https://statvibe-landing.vercel.app |
| Admin (suggested) | https://statvibe-admin.vercel.app |

## How versions bump

1. **Product / API** — bump root + `statvibe-server` + `statvibe-client` `package.json` and `VERSION` in `server.js` together.
2. **PWA shell** — bump `CACHE` in `public/sw.js` and `statvibe-client/public/sw.js` (e.g. `statvibe-v42`) when static shell assets change.
3. **Landing / Admin** — independent `0.x` until promoted; record in changelog when shipping user-facing changes.
4. **Marketing pack** — update `content/changelogs/CHANGELOG.md` and this file on every release.

## Advertising accuracy rule

Only claim features listed as **Shipped** in [`FEATURES.md`](./FEATURES.md). Never show Coming Soon models, 2FA, native stores, or live ops alerts as if they exist.
