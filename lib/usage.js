// Plan limits + usage periods (Free resets weekly; paid plans monthly).
// Limits are AI tokens (prompt + completion), not request counts.
const WEEK_MS = 7 * 24 * 3600 * 1000;
const MONTH_MS = 30 * 24 * 3600 * 1000;

// Marketing packs: Free feels generous weekly; Pro/Business convert for volume.
const PLAN_LIMITS = { Free: 50000, Pro: 1000000, Business: 5000000, Enterprise: 999999999 };
// PHP prices charged via PayMongo QR Ph (pesos).
const PLAN_PRICES = { Free: 0, Pro: 1699, Business: 4499, Enterprise: 0 };

function periodMsFor(plan) {
  if (plan === 'Enterprise') return null; // unlimited / no reset window
  if (plan === 'Free') return WEEK_MS;
  return MONTH_MS;
}

function periodLabel(plan) {
  if (plan === 'Enterprise') return 'none';
  if (plan === 'Free') return 'week';
  return 'month';
}

/** Rough token estimate (~4 chars / token) when the model does not return usage. */
function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

function countMessageTokens(usage, promptText, completionText) {
  if (usage && (usage.prompt_tokens || usage.completion_tokens)) {
    return Math.max(1, (Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0));
  }
  return estimateTokens(promptText) + estimateTokens(completionText);
}

/** Roll the usage window forward when the Free week (or paid month) has elapsed. */
function ensureUsage(account) {
  const acct = account && typeof account === 'object' ? { ...account } : {};
  const plan = PLAN_LIMITS.hasOwnProperty(acct.plan) ? acct.plan : 'Free';
  const period = periodMsFor(plan);
  let start = Number(acct.aiPeriodStart) || Date.now();
  let used = Math.max(0, Number(acct.aiUsed) || 0);
  if (period && Date.now() - start >= period) {
    start = Date.now();
    used = 0;
  }
  const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.Free;
  const resetAt = period ? start + period : null;
  const resetDays = resetAt != null ? Math.max(0, Math.ceil((resetAt - Date.now()) / 86400000)) : null;
  return {
    ...acct,
    plan,
    aiUsed: used,
    aiPeriodStart: start,
    aiLimit: limit,
    aiResetAt: resetAt,
    aiResetDays: resetDays,
  };
}

function usageView(account) {
  const a = ensureUsage(account);
  return {
    used: a.aiUsed,
    limit: a.aiLimit,
    resetDays: a.aiResetDays,
    resetAt: a.aiResetAt,
    plan: a.plan,
    period: periodLabel(a.plan),
    remaining: a.plan === 'Enterprise' ? null : Math.max(0, a.aiLimit - a.aiUsed),
    unit: 'tokens',
  };
}

function canConsume(account, n = 1) {
  const a = ensureUsage(account);
  if (a.plan === 'Enterprise') return { ok: true, account: a };
  // Pre-check: block only when no tokens remain; bill actual usage after the reply.
  if (a.aiUsed >= a.aiLimit) {
    return {
      ok: false,
      account: a,
      code: 'quota_exceeded',
      error: a.plan === 'Free'
        ? `Free plan limit reached (${a.aiLimit.toLocaleString()} AI tokens this week). Upgrade for more, or wait ${a.aiResetDays} day${a.aiResetDays === 1 ? '' : 's'} for your weekly reset.`
        : `Plan limit reached (${a.aiLimit.toLocaleString()} AI tokens this ${periodLabel(a.plan)}). Upgrade for a higher limit.`,
    };
  }
  return { ok: true, account: a };
}

/** Bill real/estimated tokens after a successful reply. */
function billTokens(account, n = 1) {
  const a = ensureUsage(account);
  const add = Math.max(1, Math.floor(Number(n) || 1));
  if (a.plan === 'Enterprise') return { ok: true, account: a, usage: usageView(a), billed: 0 };
  a.aiUsed = (a.aiUsed || 0) + add;
  return { ok: true, account: a, usage: usageView(a), billed: add };
}

/** @deprecated Prefer canConsume + billTokens; kept for tests that still call consume. */
function consume(account, n = 1) {
  const check = canConsume(account, n);
  if (!check.ok) return check;
  return billTokens(check.account, n);
}

module.exports = {
  WEEK_MS, MONTH_MS, PLAN_LIMITS, PLAN_PRICES,
  periodMsFor, periodLabel, ensureUsage, usageView,
  canConsume, billTokens, countMessageTokens, estimateTokens, consume,
};
