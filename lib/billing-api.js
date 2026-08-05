/**
 * HTTP handlers for billing, PayMongo checkout/webhooks, and system notifications.
 * Wired from server.js / statvibe-server/server.js.
 */
'use strict';

const billing = require('./billing');

function monthMs() { return 30 * 24 * 3600 * 1000; }

async function resolveConfig(store) {
  const raw = await store.getSubscriptionsConfig();
  return billing.mergeConfig(raw);
}

async function isFirstTimeSubscriber(store, userId) {
  const sub = await store.getUserSubscription(userId);
  if (sub && (sub.status === 'ACTIVE' || sub.status === 'CANCELLED' || sub.hadPaidPlan)) return false;
  const txs = await store.listPaymentTransactions(200);
  if (txs.some((t) => t.userId === userId && ['paid', 'succeeded', 'demo'].includes(t.status))) return false;
  return true;
}

async function activateSubscription(store, usageLib, auth, {
  userId, plan, quote, providerPaymentId, checkoutSessionId, paymentMethod, txId,
}) {
  const existingTx = providerPaymentId
    ? await store.findPaymentTransactionByProviderId(providerPaymentId)
    : null;
  if (existingTx && ['paid', 'succeeded', 'demo'].includes(existingTx.status)) {
    return { activated: false, reason: 'already_processed', transaction: existingTx };
  }

  const acct = usageLib.ensureUsage(await store.getAccount(userId) || { plan: 'Free', inventory: [], ideas: [], statsDraft: {}, calc: {}, supply: {}, branches: [], currency: 'USD', businessName: '', industry: '' });
  const prev = acct.plan || 'Free';
  acct.plan = plan;
  acct.aiUsed = 0;
  acct.aiPeriodStart = Date.now();
  const normalized = usageLib.ensureUsage(acct);
  await store.setAccount(userId, normalized);

  const now = Date.now();
  const subscription = {
    userId,
    plan,
    status: 'ACTIVE',
    paymongoCustomerId: null,
    currentPeriodStart: now,
    currentPeriodEnd: now + monthMs(),
    hadPaidPlan: true,
    lastPaymentId: txId || providerPaymentId || null,
    updatedAt: now,
  };
  await store.setUserSubscription(userId, subscription);

  let transaction = existingTx;
  if (transaction) {
    transaction = await store.updatePaymentTransaction(transaction.id, {
      status: 'paid',
      providerPaymentId: providerPaymentId || transaction.providerPaymentId,
      checkoutSessionId: checkoutSessionId || transaction.checkoutSessionId,
      paymentMethod: paymentMethod || transaction.paymentMethod,
      paidAt: now,
    });
  } else if (txId) {
    transaction = await store.updatePaymentTransaction(txId, {
      status: 'paid',
      providerPaymentId,
      checkoutSessionId,
      paymentMethod,
      paidAt: now,
    });
  }

  return { activated: true, previousPlan: prev, account: normalized, subscription, transaction };
}

function attachBillingRoutes({
  store, auth, usageLib, sendJSON, parseJSON, getAuthUser, requireAdmin, readRawBody,
}) {
  return {
    async handleBilling(req, res, sub, body) {
      // Public catalog (auth optional — firstTime accurate when signed in)
      if ((sub === 'catalog' || sub === 'pricing') && req.method === 'GET') {
        const cfg = await resolveConfig(store);
        let firstTime = true;
        const authed = await getAuthUser(req);
        if (authed) firstTime = await isFirstTimeSubscriber(store, authed.user.id);
        const { quotes } = billing.catalogQuotes(cfg, { firstTime });
        return sendJSON(res, 200, {
          betaSaleEnabled: cfg.betaSaleEnabled,
          vatRate: cfg.vatRate,
          currency: cfg.currency,
          firstTimeSubscriber: firstTime,
          quotes,
          tiers: cfg.tiers,
        });
      }

      if (sub === 'quote' && req.method === 'POST') {
        const authed = await getAuthUser(req);
        if (!authed) return sendJSON(res, 401, { error: 'Not signed in' });
        const b = parseJSON(body) || {};
        const plan = String(b.plan || '');
        const cfg = await resolveConfig(store);
        const tier = cfg.tiers[plan];
        if (!tier || plan === 'Free') return sendJSON(res, 400, { error: 'Unknown or free plan' });
        if (tier.contactSales) return sendJSON(res, 400, { error: 'Enterprise requires sales contact' });
        const firstTime = await isFirstTimeSubscriber(store, authed.user.id);
        const quote = billing.quoteTier(tier, {
          betaSaleEnabled: cfg.betaSaleEnabled,
          firstTime,
          vatRate: cfg.vatRate,
        });
        return sendJSON(res, 200, { quote, firstTimeSubscriber: firstTime });
      }

      if (sub === 'checkout' && req.method === 'POST') {
        const authed = await getAuthUser(req);
        if (!authed) return sendJSON(res, 401, { error: 'Not signed in' });
        const { user } = authed;
        const b = parseJSON(body) || {};
        const plan = String(b.plan || '');
        const cfg = await resolveConfig(store);
        const tier = cfg.tiers[plan];
        if (!tier || plan === 'Free') return sendJSON(res, 400, { error: 'Unknown or free plan' });
        if (tier.contactSales) return sendJSON(res, 400, { error: 'Enterprise requires sales contact' });

        const firstTime = await isFirstTimeSubscriber(store, user.id);
        const quote = billing.quoteTier(tier, {
          betaSaleEnabled: cfg.betaSaleEnabled,
          firstTime,
          vatRate: cfg.vatRate,
        });
        if (quote.totalCents <= 0) {
          return sendJSON(res, 400, { error: 'Nothing to charge' });
        }

        const clientBase = (process.env.CLIENT_URL || 'https://stat-vibe.vercel.app').replace(/\/$/, '');
        const successUrl = b.successUrl || `${clientBase}/?billing=success&plan=${encodeURIComponent(plan)}`;
        const cancelUrl = b.cancelUrl || `${clientBase}/?billing=cancel`;

        const txId = auth.newId('txn');
        const pending = {
          id: txId,
          userId: user.id,
          email: user.isGuest ? null : (user.email || null),
          name: user.name || null,
          plan,
          currency: 'USD',
          subtotalCents: quote.subtotalCents,
          vatCents: quote.vatCents,
          totalCents: quote.totalCents,
          saleApplied: quote.saleApplied,
          status: 'PENDING',
          source: 'paymongo-checkout',
          paymentMethod: null,
          checkoutSessionId: null,
          providerPaymentId: null,
          idempotencyKey: txId,
          phpCentavos: billing.usdCentsToPhpCentavos(quote.totalCents),
          createdAt: Date.now(),
        };

        if (!process.env.PAYMONGO_SECRET_KEY) {
          pending.status = 'pending_unconfigured';
          await store.addPaymentTransaction(pending);
          // Demo activate when PayMongo unset (local/dev) if explicitly requested
          if (b.demoActivate) {
            const act = await activateSubscription(store, usageLib, auth, {
              userId: user.id, plan, quote, txId,
            });
            await store.updatePaymentTransaction(txId, { status: 'demo', paidAt: Date.now() });
            return sendJSON(res, 200, {
              configured: false,
              demo: true,
              quote,
              transactionId: txId,
              account: act.account,
              subscription: act.subscription,
              message: 'PayMongo not configured — demo activation applied.',
            });
          }
          return sendJSON(res, 200, {
            configured: false,
            quote,
            transactionId: txId,
            message: 'PayMongo not configured. Set PAYMONGO_SECRET_KEY to enable live checkout.',
          });
        }

        try {
          const session = await billing.createCheckoutSession({
            quote,
            user,
            successUrl,
            cancelUrl,
            metadata: { transaction_id: txId },
          });
          pending.checkoutSessionId = session.checkoutId;
          pending.phpCentavos = session.phpCentavos;
          await store.addPaymentTransaction(pending);
          await store.setUserSubscription(user.id, {
            ...(await store.getUserSubscription(user.id) || {}),
            userId: user.id,
            plan,
            status: 'PENDING',
            updatedAt: Date.now(),
            lastPaymentId: txId,
          });
          return sendJSON(res, 200, {
            configured: true,
            quote,
            transactionId: txId,
            checkoutId: session.checkoutId,
            checkoutUrl: session.checkoutUrl,
            phpCentavos: session.phpCentavos,
            usdPhpRate: session.usdPhpRate,
          });
        } catch (e) {
          pending.status = 'failed';
          pending.error = e.message;
          await store.addPaymentTransaction(pending);
          return sendJSON(res, 502, { error: 'PayMongo checkout failed: ' + e.message, quote });
        }
      }

      if (sub === 'subscription' && req.method === 'GET') {
        const authed = await getAuthUser(req);
        if (!authed) return sendJSON(res, 401, { error: 'Not signed in' });
        const subRow = await store.getUserSubscription(authed.user.id);
        const acct = await store.getAccount(authed.user.id);
        return sendJSON(res, 200, {
          subscription: subRow,
          plan: (acct && acct.plan) || 'Free',
        });
      }

      return sendJSON(res, 404, { error: 'Unknown billing endpoint' });
    },

    async handlePaymongoWebhook(req, res, rawBody) {
      const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
      const sig = req.headers['paymongo-signature'] || req.headers['Paymongo-Signature'];
      if (secret) {
        const ok = billing.verifyPaymongoSignature(rawBody, sig, secret);
        if (!ok) return sendJSON(res, 401, { error: 'Invalid webhook signature' });
      }
      let event;
      try {
        event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
      } catch {
        return sendJSON(res, 400, { error: 'Invalid JSON' });
      }
      const type = event && event.data && event.data.attributes && event.data.attributes.type
        ? event.data.attributes.type
        : event.type;
      const data = event && event.data && event.data.attributes && event.data.attributes.data
        ? event.data.attributes.data
        : event.data;

      const attrs = (data && data.attributes) || {};
      const meta = attrs.metadata || {};
      const checkoutId = data && data.id && String(data.id).startsWith('cs_') ? data.id : (attrs.checkout_session_id || null);
      const paymentId = data && data.id && String(data.id).startsWith('pay_') ? data.id : (attrs.payment_id || null);
      const providerId = paymentId || checkoutId || (data && data.id) || null;

      if (type === 'payment.failed') {
        const existing = await store.findPaymentTransactionByProviderId(providerId)
          || (meta.transaction_id ? (await store.listPaymentTransactions(50)).find((t) => t.id === meta.transaction_id) : null);
        if (existing) await store.updatePaymentTransaction(existing.id, { status: 'failed' });
        return sendJSON(res, 200, { ok: true, handled: 'failed' });
      }

      if (type === 'payment.paid' || type === 'checkout_session.payment.paid') {
        let tx = await store.findPaymentTransactionByProviderId(providerId);
        if (!tx && meta.transaction_id) {
          const list = await store.listPaymentTransactions(100);
          tx = list.find((t) => t.id === meta.transaction_id) || null;
        }
        if (!tx && checkoutId) tx = await store.findPaymentTransactionByProviderId(checkoutId);
        if (!tx) {
          return sendJSON(res, 200, { ok: true, handled: 'ignored_unknown_tx' });
        }
        if (['paid', 'succeeded', 'demo'].includes(tx.status)) {
          return sendJSON(res, 200, { ok: true, handled: 'idempotent_skip' });
        }
        const plan = tx.plan || meta.plan;
        const act = await activateSubscription(store, usageLib, auth, {
          userId: tx.userId,
          plan,
          quote: {
            plan,
            subtotalCents: tx.subtotalCents,
            vatCents: tx.vatCents,
            totalCents: tx.totalCents,
          },
          providerPaymentId: paymentId || providerId,
          checkoutSessionId: checkoutId || tx.checkoutSessionId,
          paymentMethod: attrs.source && attrs.source.type ? attrs.source.type : (attrs.payment_method_used || null),
          txId: tx.id,
        });
        return sendJSON(res, 200, { ok: true, handled: 'paid', activated: act.activated });
      }

      return sendJSON(res, 200, { ok: true, handled: 'ignored', type });
    },

    async handleAdminBilling(req, res, sub, body, adminUser) {
      if (sub === 'subscriptions-config' && req.method === 'GET') {
        const cfg = await resolveConfig(store);
        const preview = billing.catalogQuotes(cfg, { firstTime: true });
        return sendJSON(res, 200, { config: cfg, preview: preview.quotes });
      }
      if (sub === 'subscriptions-config' && req.method === 'PUT') {
        const b = parseJSON(body);
        if (!b) return sendJSON(res, 400, { error: 'Invalid JSON' });
        const merged = billing.mergeConfig({
          ...(await store.getSubscriptionsConfig()),
          ...b,
          tiers: { ...((await resolveConfig(store)).tiers), ...(b.tiers || {}) },
          updatedAt: Date.now(),
          updatedBy: adminUser && (adminUser.username || adminUser.id) || 'admin',
        });
        // Normalize nested tier patches
        if (b.tiers) {
          for (const [id, patch] of Object.entries(b.tiers)) {
            merged.tiers[id] = { ...merged.tiers[id], ...patch, id };
          }
        }
        await store.setSubscriptionsConfig(merged);
        const preview = billing.catalogQuotes(merged, { firstTime: true });
        return sendJSON(res, 200, { config: merged, preview: preview.quotes });
      }
      if (sub === 'transactions' && req.method === 'GET') {
        return sendJSON(res, 200, { transactions: await store.listPaymentTransactions(100) });
      }
      return sendJSON(res, 404, { error: 'Unknown admin billing endpoint' });
    },

    async handleAdminNotifications(req, res, sub, body, adminUser) {
      if (sub === '' && req.method === 'GET') {
        return sendJSON(res, 200, {
          notifications: await store.listSystemNotifications({ includeInactive: true }),
          categories: billing.NOTIFICATION_CATEGORIES,
        });
      }
      if (sub === '' && req.method === 'POST') {
        const b = parseJSON(body);
        if (!b || !b.title || !b.body) return sendJSON(res, 400, { error: 'title and body required' });
        const category = billing.NOTIFICATION_CATEGORIES.includes(b.category) ? b.category : 'system_update';
        const note = await store.upsertSystemNotification({
          id: auth.newId('ntf'),
          title: String(b.title).trim(),
          body: String(b.body).trim(),
          category,
          target: b.target || 'all',
          channels: Array.isArray(b.channels) ? b.channels : ['in_app'],
          startsAt: b.startsAt ? Number(b.startsAt) : Date.now(),
          endsAt: b.endsAt ? Number(b.endsAt) : null,
          dismissible: b.dismissible !== false,
          ctaLabel: b.ctaLabel ? String(b.ctaLabel) : null,
          ctaUrl: b.ctaUrl ? String(b.ctaUrl) : null,
          active: b.active !== false,
          createdBy: adminUser && (adminUser.username || adminUser.id) || 'admin',
          createdAt: Date.now(),
        });
        return sendJSON(res, 201, { notification: note });
      }
      if (sub && req.method === 'PATCH') {
        const b = parseJSON(body) || {};
        const list = await store.listSystemNotifications({ includeInactive: true });
        const existing = list.find((n) => n.id === sub);
        if (!existing) return sendJSON(res, 404, { error: 'Not found' });
        const note = await store.upsertSystemNotification({ ...existing, ...b, id: sub });
        return sendJSON(res, 200, { notification: note });
      }
      if (sub && req.method === 'DELETE') {
        await store.deleteSystemNotification(sub);
        return sendJSON(res, 200, { ok: true });
      }
      return sendJSON(res, 404, { error: 'Unknown notifications endpoint' });
    },

    async handlePublicNotifications(req, res) {
      if (req.method !== 'GET') return sendJSON(res, 405, { error: 'Method not allowed' });
      const notes = await store.listSystemNotifications({ includeInactive: false });
      return sendJSON(res, 200, { notifications: notes });
    },
  };
}

module.exports = {
  attachBillingRoutes,
  activateSubscription,
  resolveConfig,
  isFirstTimeSubscriber,
};
