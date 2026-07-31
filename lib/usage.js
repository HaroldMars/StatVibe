// Plan limits + usage periods (Free resets weekly; paid plans monthly).
const WEEK_MS = 7 * 24 * 3600 * 1000;
const MONTH_MS = 30 * 24 * 3600 * 1000;

const PLAN_LIMITS = { Free: 1000, Pro: 10000, Business: 50000, Enterprise: 999999 };
const PLAN_PRICES = { Free: 0, Pro: 29, Business: 79, Enterprise: 0 };

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
  const limit = PLAN_LIMITS[plan] || 1000;
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
  };
}

function canConsume(account, n = 1) {
  const a = ensureUsage(account);
  if (a.plan === 'Enterprise') return { ok: true, account: a };
  if (a.aiUsed + n > a.aiLimit) {
    return {
      ok: false,
      account: a,
      code: 'quota_exceeded',
      error: a.plan === 'Free'
        ? `Free plan limit reached (${a.aiLimit} AI actions this week). Upgrade for more, or wait ${a.aiResetDays} day${a.aiResetDays === 1 ? '' : 's'} for your weekly reset.`
        : `Plan limit reached (${a.aiLimit} AI actions this ${periodLabel(a.plan)}). Upgrade for a higher limit.`,
    };
  }
  return { ok: true, account: a };
}

function consume(account, n = 1) {
  const check = canConsume(account, n);
  if (!check.ok) return check;
  const a = check.account;
  a.aiUsed = (a.aiUsed || 0) + n;
  return { ok: true, account: a, usage: usageView(a) };
}

module.exports = {
  WEEK_MS, MONTH_MS, PLAN_LIMITS, PLAN_PRICES,
  periodMsFor, periodLabel, ensureUsage, usageView, canConsume, consume,
};
