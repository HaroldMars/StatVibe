# PayMongo webhooks (local verification)

StatVibe listens at:

```
POST /api/webhooks/paymongo
```

Handled events:

- `payment.paid`
- `checkout_session.payment.paid`
- `payment.failed`

Payment activation is **idempotent** — repeated webhooks for the same PayMongo payment / checkout session ID will not double-activate a subscription.

## Env

```bash
PAYMONGO_SECRET_KEY=sk_test_xxx
PAYMONGO_WEBHOOK_SECRET=whsec_xxx   # from PayMongo dashboard / CLI
USD_PHP_RATE=56                     # catalog is USD; PayMongo charges PHP
CLIENT_URL=https://stat-vibe.vercel.app
```

## Local tunnel + CLI

1. Start the API (`npm run dev:server` or the `statvibe-server` package).
2. Expose it:

```bash
npx ngrok http 4173
# or: cloudflared tunnel --url http://localhost:4173
```

3. Register the public URL in PayMongo (Dashboard → Webhooks) or with the PayMongo CLI:

```bash
# Example — point at your tunnel
# https://dashboard.paymongo.com → Developers → Webhooks
# URL: https://<tunnel>/api/webhooks/paymongo
# Events: payment.paid, checkout_session.payment.paid, payment.failed
```

4. Complete a test Checkout Session (GCash / Maya / card test methods). Confirm:

- `GET /api/billing/subscription` shows `status: ACTIVE`
- Admin → Transactions lists the invoice with subtotal, VAT, and total

## Manual payload smoke test

```bash
curl -sS -X POST http://localhost:4173/api/webhooks/paymongo \
  -H 'Content-Type: application/json' \
  -d '{
    "data": {
      "attributes": {
        "type": "payment.paid",
        "data": {
          "id": "pay_test_123",
          "attributes": {
            "metadata": { "transaction_id": "<txn id from checkout>" }
          }
        }
      }
    }
  }'
```

Without `PAYMONGO_WEBHOOK_SECRET`, signature checks are skipped (local only). Always set the secret in production.
