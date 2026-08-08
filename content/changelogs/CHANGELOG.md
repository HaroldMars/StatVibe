# StatVibe Changelog

Product version: **1.0.0-beta** · App shell (service worker): **statvibe-v41**  
Company: Illuminary Peak

---

## [1.0.0-beta] — 2026-08-05

### Billing & subscriptions
- Beta Sale catalog: Pro **$20 → $10**, Business **$79 → $49** (first-time)
- **12% VAT excluded** from base; checkout total = subtotal + VAT
- PayMongo Checkout Session + webhook idempotency (`payment.paid`, `checkout_session.payment.paid`, `payment.failed`)
- Durable store: `subscriptionsConfig`, `userSubscriptions`, `paymentTransactions`, `systemNotifications`
- Admin pricing editor with live VAT preview (developer console + Next admin)
- System announcement composer (maintenance / sale / update / urgent)

### Admin
- **StatVibe Admin** (`statvibe-admin`): Overview, Users, Transactions, Pricing, Announcements, Employees (CEO)
- Developer console `/admin`: ops metrics, pricing, announcements, AI test console

### App (client)
- Plans screen: live catalog, sale badges, VAT breakdown, PayMongo redirect
- Tabs: Stats, Map, Calc, Hub, AI, Agent
- Revenue ledger, branches map, calculator + inventory, Idea Hub, AI Workspace, AgentTech messaging + QR

### Landing
- Facebook + Instagram social links
- Brand-first hero (Fraunces / Sora, leaf palette)

### Platform
- Service worker shell **v41**
- Monorepo packages: client, server, landing, admin
- Hobby deploy ignore rules for unchanged packages

---

## [0.9.x] — Pre-billing beta (2026)

- Auth (register / login / guest), business setup, tutorial
- Revenue entries + cumulative chart
- Inventory + predict days left
- Map / branches (Leaflet)
- AI Workspace (hosted / Ollama / simulated)
- AgentTech messaging + StatVibe QR codes
- PWA installable shell

---

## Version matrix

| Package | npm version | Notes |
|---------|-------------|--------|
| Root / `statvibe-client` / `statvibe-server` | `1.0.0` | Product API + SPA |
| `statvibe-landing` | `0.1.0` | Marketing site |
| `statvibe-admin` | `0.1.0` | Next admin panel |
| Service worker | `statvibe-v41` | Offline shell cache |

See also: [`../doc/FEATURES.md`](../doc/FEATURES.md) · [`../doc/VERSIONS.md`](../doc/VERSIONS.md)
