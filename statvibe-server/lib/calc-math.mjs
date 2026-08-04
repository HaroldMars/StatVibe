/**
 * Pure calculator math — Retail (markup) vs Product (target margin).
 * Shared by the SPA (via public/js/calc-math.js) and Node tests.
 */

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function clampPct(v, d = 0) {
  const x = n(v, d);
  return Math.min(99.9, Math.max(0, x));
}

/** Landed / total cost shared by both modes. */
export function totalCost(calc) {
  return n(calc.unitCost) + n(calc.freight) + n(calc.overhead);
}

/**
 * Retail shelf pricing: sell = cost × (1 + markup%).
 * Markup and margin are different — a 55% markup is ~35.5% margin.
 */
export function computeRetail(calc) {
  const cost = totalCost(calc);
  const markup = clampPct(calc.markup, 0);
  const price = cost * (1 + markup / 100);
  const profit = price - cost;
  const margin = price > 0 ? (profit / price) * 100 : 0;
  return {
    mode: 'Retail',
    cost,
    price,
    profit,
    margin,
    markup,
    targetMargin: n(calc.targetMargin),
  };
}

/**
 * Product economics: sell = cost / (1 − targetMargin%).
 * Solves for the price that hits a desired gross margin.
 */
export function computeProduct(calc) {
  const cost = totalCost(calc);
  const targetMargin = clampPct(calc.targetMargin, 0);
  const denom = 1 - targetMargin / 100;
  const price = denom > 0.001 ? cost / denom : cost;
  const profit = price - cost;
  const margin = price > 0 ? (profit / price) * 100 : 0;
  const markup = cost > 0 ? (profit / cost) * 100 : 0;
  return {
    mode: 'Product',
    cost,
    price,
    profit,
    margin,
    markup,
    targetMargin,
  };
}

/** Dispatch by active tab (Supply has no pricing result). */
export function computePricing(calc) {
  const tab = calc && calc.tab;
  if (tab === 'Product') return computeProduct(calc || {});
  return computeRetail(calc || {});
}
