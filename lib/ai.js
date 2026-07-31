// Shared AI prompting — keeps every reply focused on what the user actually asked.

const ACCURACY_RULES = `RESPONSE RULES (follow strictly):
1. Identify the user's main question or concern, then answer it directly in the first 1–2 sentences.
2. Stay on that topic. Do not invent board updates, revenue figures, or unrelated advice unless they asked for it.
3. If required business numbers are missing, say what is missing and give a useful answer with clear assumptions.
4. Be specific and actionable. Prefer short paragraphs and bullets over fluff.
5. Never claim you took an action in the real world (sent email, charged a card, etc.) unless the product can do that.`;

function businessContext(account, user) {
  if (!account && !user) return '';
  const lines = [];
  if (user && user.name) lines.push(`Owner: ${user.name}`);
  if (account && account.businessName) lines.push(`Business: ${account.businessName}`);
  if (account && account.industry) lines.push(`Industry: ${account.industry}`);
  if (account && account.currency) lines.push(`Currency: ${account.currency}`);
  if (account && account.teamSize) lines.push(`Team size: ${account.teamSize}`);
  if (account && account.plan) lines.push(`Plan: ${account.plan}`);
  if (account && Array.isArray(account.goals) && account.goals.length) lines.push(`Goals: ${account.goals.join(', ')}`);
  const d = account && account.statsDraft;
  if (d && (d.revenue || d.products || d.avgPrice)) {
    lines.push(`Stats draft — revenue: ${d.revenue || '—'}, products sold: ${d.products || '—'}, avg price: ${d.avgPrice || '—'}`);
  }
  if (!lines.length) return '';
  return `\n\nBusiness context (use when relevant; do not invent beyond this):\n- ${lines.join('\n- ')}`;
}

const DEFAULT_ROLE = 'You are StatVibe, an accurate AI business assistant. Help owners with analytics, pricing, inventory, planning, messaging drafts, and operations.';

function buildSystemPrompt({ account, user, clientSystem } = {}) {
  const role = (clientSystem && String(clientSystem).trim()) || DEFAULT_ROLE;
  return `${role}\n\n${ACCURACY_RULES}${businessContext(account, user)}`;
}

/** Keep recent turns; replace/inject a single authoritative system message. */
function enrichMessages(messages, ctx = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const clientSystem = ([...list].reverse().find((m) => m && m.role === 'system') || {}).content;
  const nonSystem = list
    .filter((m) => m && m.role !== 'system' && typeof m.content === 'string')
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 12000) }))
    .slice(-24);
  return [{ role: 'system', content: buildSystemPrompt({ ...ctx, clientSystem }) }, ...nonSystem];
}

function lastUserText(messages) {
  const last = [...(messages || [])].reverse().find((m) => m && m.role === 'user' && m.content);
  return last ? String(last.content).trim() : '';
}

/** Offline/demo fallback that still mirrors the user's ask instead of a random template. */
function simulate(messages) {
  const q = lastUserText(messages);
  const lower = q.toLowerCase();
  const concern = q
    ? (q.length > 140 ? q.slice(0, 137) + '…' : q)
    : 'your request';

  let body;
  if (/board|summary|update|report/.test(lower)) {
    body = `**Direct answer:** You asked for a business update/summary.\n\nI can draft one from your live stats once revenue, products sold, and average price are filled in. Meanwhile, structure it like this:\n\n1. **Headline** — one sentence on period performance\n2. **Highlights** — 3 bullets (revenue, margin, customers)\n3. **Risks & asks** — what needs a decision\n\nPaste your latest numbers and I'll write the full draft.`;
  } else if (/price|margin|wholesale|cost|markup/.test(lower)) {
    body = `**Direct answer:** You're asking about pricing/margin.\n\n**Practical approach**\n- Start from landed cost (unit + freight + overhead)\n- Pick a target margin or markup\n- Price = cost ÷ (1 − margin%) for target-margin mode, or cost × (1 + markup%) for retail markup\n\nShare your cost and target margin/markup and I'll compute the exact sell price and profit per unit.`;
  } else if (/idea|brainstorm|project|next step/.test(lower)) {
    body = `**Direct answer:** You want concrete next steps or ideas.\n\n1. **Prove demand** — one small offer or landing test this week\n2. **Protect margin** — cut the lowest-margin channel first\n3. **Repeat buyers** — a simple loyalty or reorder prompt for existing customers\n\nTell me your industry and biggest bottleneck and I'll tailor these.`;
  } else if (/forecast|scenario|revenue|grow/.test(lower)) {
    body = `**Direct answer:** You're asking about growth/forecasting.\n\nUse three scenarios (base / upside / downside) with the same cost structure. Drivers: volume, average price, and gross margin. Change one driver at a time so the ask stays clear.\n\nShare current monthly revenue and target growth % and I'll sketch the three scenarios.`;
  } else if (q) {
    body = `**Direct answer:** Here's a focused take on what you asked — "${concern}".\n\n- Restate the goal in one line, then list constraints (budget, stock, time, team).\n- Propose 2–3 options with tradeoffs (speed vs margin vs risk).\n- End with a single recommended next action you can do this week.\n\nAdd any numbers you have (cost, stock, revenue) and I'll make this precise instead of general.`;
  } else {
    body = `Ask a specific business question (pricing, inventory, forecast, plan, or a message draft) and I'll answer that concern directly.`;
  }

  return `${body}\n\n_(Simulated engine — connect hosted AI or Ollama for live model output.)_`;
}

module.exports = { enrichMessages, buildSystemPrompt, simulate, lastUserText, ACCURACY_RULES };
