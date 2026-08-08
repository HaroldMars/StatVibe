# Test

## Automated

```bash
# From repo root
npm test
# Includes VAT / billing: test/billing.test.js, test/billing-api.test.js
```

```bash
cd statvibe-server && npm test
```

## Billing assertions (must stay green)

- Pro sale $10 → VAT $1.20 → total **$11.20**
- Business sale $49 → VAT $5.88 → total **$54.88**
- Admin price override appears on `GET /api/billing/catalog` without redeploy
- Webhook idempotency for repeated `payment.paid`

## Marketing accuracy checklist

Before publishing any ad or social cut:

- [ ] UI chrome matches indigo app (`#5865f2`), not a fictional redesign
- [ ] Features shown are listed as **Shipped** in `../doc/FEATURES.md`
- [ ] No App Store badges unless store URLs are live
- [ ] No “live alerts” montage using sample alert cards as product truth
- [ ] Plans copy matches Free / Pro / Business / Enterprise + beta VAT story
- [ ] Logo is StatVibe **S** mark (enhanced asset OK; no third-party gem/sparkle marks)
