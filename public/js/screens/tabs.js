import { state } from '../state.js';
import { I } from '../icons.js';
import { tabbar } from '../chrome.js';
import {
  esc, money, currency, calcSummary, hasStatInputs, statNum, bizName, userName,
  initials, convAvatar, relTime,
} from '../utils.js';
import { computeRetail, computeProduct } from '../calc-math.js';
import { totalRevenue, cumulativeSeries, seriesToSvg } from '../revenue-math.js';

export const tabScreens = {};
export const screens = {};

export function statsCard() {
  const inv = state.session.inventory || [];
  const s = state.statsDraft || {};
  const entries = (state.session.account && state.session.account.revenueEntries) || [];
  const revenue = entries.length ? totalRevenue(entries) : statNum(s.revenue);
  const products = statNum(s.products);
  const avgPrice = statNum(s.avgPrice);
  const hasManual = hasStatInputs();
  if (!hasManual) {
    return `
    <div class="card mb-12" style="text-align:center;padding:28px 20px">
      <div style="font-size:36px;margin-bottom:10px">📊</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">No revenue yet</div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:18px">Log each sale as its own entry. Your total and line chart grow in real time as you add amounts.</div>
      <button class="btn" data-act="addRevenue">Add revenue</button>
    </div>
    <div class="grid-3 mb-12">
      ${[['Revenue', money(0), '—', 'up'], ['Products', products ? products.toLocaleString() : '0', '—', 'up'], ['Avg price', avgPrice ? money(avgPrice) : money(0), '—', 'up']]
        .map(([k, v, d]) => `<div class="card" style="padding:11px"><div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:6px">${k}</div><div class="big-num" style="font-size:18px">${v}</div><div style="font-size:10.5px;font-weight:600;margin-top:2px;color:var(--muted-3)">${d}</div></div>`).join('')}
    </div>`;
  }
  const totalStock = products || inv.reduce((sum, i) => sum + (Number(i.stock) || 0), 0);
  const period = state.revenuePeriod || 'live';
  const series = cumulativeSeries(entries, period);
  const { line, area } = seriesToSvg(series);
  const periodLabel = period === 'week' ? 'by week' : period === 'month' ? 'by month' : period === 'day' ? 'by day' : 'each sale';
  const cs = calcSummary();
  const askQ = `Analyze my business. Stats: revenue ${money(revenue)} across ${entries.length} entries, products sold ${totalStock}, average price ${money(avgPrice)}. Calculator — Retail shelf price ${money(cs.retail.price)} from ${cs.retail.markup}% markup (${cs.retail.margin.toFixed(1)}% margin, profit ${money(cs.retail.profit)}/unit). Product target-margin price ${money(cs.product.price)} at ${cs.product.targetMargin}% gross margin (cost ${money(cs.product.cost)}, profit ${money(cs.product.profit)}/unit). Supply on hand ${cs.onHand.toLocaleString()} across ${cs.items} SKUs. Give me 3 concrete actions to grow next month.`;
  return `
    <div class="card mb-12" style="padding:16px 16px 14px">
      <div class="row-between mb-8">
        <div class="eyebrow" data-act="goto" data-s="revenue" style="cursor:pointer">Revenue · live cumulative</div>
        <button class="pill" data-act="addRevenue" style="font-size:11px">+ Add</button>
      </div>
      <div class="flex items-center" style="gap:10px;align-items:baseline;margin-bottom:2px">
        <div class="big-num" style="font-size:34px">${money(revenue)}</div>
      </div>
      <div style="font-size:11.5px;color:var(--muted-2);margin-bottom:8px">${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · ${periodLabel}${products ? ` · ${totalStock.toLocaleString()} products` : ''}</div>
      <div class="flex gap-8 mb-8 flex-wrap">
        ${[['live', 'Live'], ['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(([p, lab]) => `<button class="pill${period === p ? ' solid' : ''}" data-act="revenuePeriod" data-p="${p}" style="font-size:11px">${lab}</button>`).join('')}
      </div>
      ${series.length ? `
      <svg viewBox="0 0 300 100" width="100%" height="92" preserveAspectRatio="none" aria-label="Cumulative revenue chart">
        <defs><linearGradient id="svStatsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F766E" stop-opacity=".28"/><stop offset="1" stop-color="#0F766E" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#svStatsFill)"/>
        <path d="${line}" fill="none" stroke="#0F766E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>` : `<div style="font-size:12px;color:var(--muted);padding:18px 0;text-align:center">Add another entry to see growth over time</div>`}
    </div>
    <div class="grid-3 mb-12">
      ${[['Revenue', money(revenue), '', 'up'], ['Products', totalStock ? totalStock.toLocaleString() : '—', '', 'up'], ['Avg price', avgPrice ? money(avgPrice) : '—', '', 'up']]
        .map(([k, v, d]) => `<div class="card" style="padding:11px"><div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:6px">${k}</div><div class="big-num" style="font-size:18px">${v}</div>${d ? `<div style="font-size:10.5px;font-weight:600;margin-top:2px;color:var(--teal)">${d}</div>` : ''}</div>`).join('')}
    </div>
    <div class="card mb-12" style="padding:14px 15px">
      <div class="row-between mb-10">
        <div style="font-size:13px;font-weight:600">From Calculator</div>
        <button class="pill" data-tab="calc" style="font-size:11px">Open Calc ›</button>
      </div>
      <div class="grid-3">
        <div>
          <div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:4px">Retail</div>
          <div class="big-num" style="font-size:16px">${money(cs.retail.price)}</div>
          <div style="font-size:10.5px;color:var(--muted-2);margin-top:2px">${cs.retail.markup}% markup · ${cs.retail.margin.toFixed(1)}% gm</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:4px">Product</div>
          <div class="big-num" style="font-size:16px">${money(cs.product.price)}</div>
          <div style="font-size:10.5px;color:var(--muted-2);margin-top:2px">${cs.product.targetMargin}% target · cost ${money(cs.product.cost)}</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:4px">Supply</div>
          <div class="big-num" style="font-size:16px">${cs.onHand.toLocaleString()}</div>
          <div style="font-size:10.5px;color:var(--muted-2);margin-top:2px">${cs.items} SKU${cs.items === 1 ? '' : 's'}</div>
        </div>
      </div>
    </div>
    <div class="card dark mb-12" style="padding:14px 15px">
      <div class="flex items-center" style="gap:7px;margin-bottom:8px">
        ${I.spark('#7FE3C8', 15, true)}
        <span style="font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--mint)">Stats insight</span>
      </div>
      <div style="font-size:13.5px;line-height:1.5;color:#D8E4E0">You're tracking <b style="color:#fff">${money(revenue)}</b> across <b style="color:#fff">${entries.length}</b> revenue entr${entries.length === 1 ? 'y' : 'ies'}${products ? ` · ${totalStock.toLocaleString()} products` : ''}${avgPrice ? ` · avg ${money(avgPrice)}` : ''}.</div>
      <div class="insight-actions">
        <button class="btn sm mint" data-act="addRevenue">Add revenue</button>
        <button class="btn sm" data-act="askAI" data-q="${esc(askQ)}" style="flex:1;background:rgba(255,255,255,.08);color:#EAF0EE">Ask AI</button>
      </div>
    </div>`;
}

tabScreens.stats = () => `
  <div class="scroll pad-top" style="padding-left:18px;padding-right:18px;padding-bottom:14px">
    <div class="row-between mb-20" style="padding-top:0">
      <div class="flex items-center gap-10">
        <div style="width:34px;height:34px;border-radius:9px;background:var(--teal);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;letter-spacing:.5px">${initials(bizName())}</div>
        <div>
          <div class="flex items-center" style="gap:5px;font-weight:600;font-size:14px" data-act="goto" data-s="settings">${esc(bizName())} ${I.chevDown}</div>
          <div style="font-size:11px;color:var(--muted-2)">Overview · This month</div>
        </div>
      </div>
      <div class="flex gap-8">
        <button class="iconbtn" data-act="goto" data-s="alerts">${I.bell}</button>
        <button class="iconbtn accent" data-tab="ai">${I.spark('#fff', 16, true)}</button>
        <button class="iconbtn" data-act="goto" data-s="settings" title="Settings & profile" style="background:var(--teal);border:none;color:#fff;font-weight:700;font-size:12px;letter-spacing:.3px">${initials(userName())}</button>
      </div>
    </div>

    ${statsCard()}
  </div>
  ${tabbar('stats')}`;

tabScreens.calc = () => {
  const c = state.calc;
  const t = c.tab;
  const retail = computeRetail(c);
  const product = computeProduct(c);
  const active = t === 'Product' ? product : retail;
  const costLabel = t === 'Product' ? 'Total product cost' : 'Landed cost';
  const priceLabel = t === 'Product' ? 'Suggested sell price' : 'Suggested retail price';
  const secondaryLabel = t === 'Product' ? 'Gross margin' : 'Gross margin';
  const secondaryValue = `${active.margin.toFixed(1)}%`;
  const fields = t === 'Product'
    ? [
      ['Materials / COGS', 'unitCost', true],
      ['Labor / assembly', 'freight', true],
      ['Overhead', 'overhead', true],
      ['Target gross margin', 'targetMargin', false],
    ]
    : [
      ['Unit cost', 'unitCost', true],
      ['Freight + duty', 'freight', true],
      ['Overhead allocation', 'overhead', true],
      ['Target markup', 'markup', false],
    ];
  const hint = t === 'Product'
    ? `Product mode sets price from a <b>target gross margin</b>. Cost ${money(active.cost)} → price ${money(active.price)} (profit ${money(active.profit)}/unit · implied markup ${active.markup.toFixed(1)}%).`
    : `Retail mode marks up cost: price = cost × (1 + markup%). Cost ${money(active.cost)} + ${active.markup}% markup → ${money(active.price)} (profit ${money(active.profit)}/unit).`;
  const skuLine = t === 'Product' ? 'Product economics · build & sell' : 'Retail shelf pricing · SKU TH-402';

  return `
  <div class="scroll pad">
    <div class="row-between mb-14">
      <div><div class="h-page">Calculator</div><div class="sub">Retail markup · Product margin · Supply</div></div>
      <button class="iconbtn accent" data-act="addItem" title="Add product">${I.plus('#fff')}</button>
    </div>
    <div class="segmented mb-14" data-seg="calc">
      ${['Retail', 'Product', 'Supply'].map((x) => `<button class="${t === x ? 'active' : ''}" data-v="${x}">${x}</button>`).join('')}
    </div>

    ${t !== 'Supply' ? `
    <div class="card mb-12">
      <div style="font-size:12px;color:var(--muted-2);margin-bottom:10px">${skuLine}</div>
      ${fields.map(([lab, key, moneyField]) => {
        const raw = Number(c[key]);
        const shown = moneyField ? raw.toFixed(2) : String(raw);
        return `<div class="row-between" style="padding:9px 0;border-bottom:1px solid var(--hairline)"><span style="font-size:13px">${lab}</span><span class="flex items-center" style="gap:2px">${moneyField ? `<span class="mono" style="font-size:14px">${esc(currency().symbol)}</span>` : ''}<input class="mono calc-input" data-k="${key}" value="${shown}" inputmode="decimal" style="width:${moneyField ? 64 : 44}px;border:none;background:none;text-align:right;font-size:14px;font-weight:500;outline:none;color:var(--ink);border-bottom:1px dashed var(--line-2)"/>${moneyField ? '' : '<span class="mono" style="font-size:14px">%</span>'}</span></div>`;
      }).join('')}
      <div style="font-size:11.5px;color:var(--muted);line-height:1.45;margin-top:12px">${hint}</div>
    </div>

    <div class="card dark mb-12" style="padding:15px 16px" data-calc-result="${t}">
      <div class="row-between" style="align-items:flex-end;margin-bottom:12px">
        <div><div class="eyebrow" style="color:var(--mint);margin-bottom:4px">${priceLabel}</div><div class="big-num" style="font-size:32px" data-calc="price">${money(active.price)}</div></div>
        <div style="text-align:right"><div style="font-size:11px;color:#9FBAB2;margin-bottom:4px">${secondaryLabel}</div><div class="big-num" style="font-size:24px;color:var(--mint)" data-calc="margin">${secondaryValue}</div></div>
      </div>
      <div class="row-between" style="font-size:11px;color:#9FBAB2;margin-bottom:5px">
        <span data-calc="cost-line">${costLabel} ${money(active.cost)} · Profit ${money(active.profit)}/unit</span>
        <span data-calc="target-line">${t === 'Product' ? `Target ${active.targetMargin}%` : `Markup ${active.markup}%`}</span>
      </div>
      <div class="meter" style="background:rgba(255,255,255,.12)"><i data-calc="meter" style="width:${Math.min(100, active.margin).toFixed(0)}%;background:var(--mint)"></i></div>
      <div class="grid-2" style="gap:8px;margin-top:12px">
        <div style="background:rgba(255,255,255,.06);border-radius:10px;padding:10px 11px">
          <div style="font-size:10px;color:#9FBAB2;margin-bottom:3px">${t === 'Product' ? 'Implied markup' : 'Profit / unit'}</div>
          <div class="big-num" style="font-size:16px;color:#EAF0EE" data-calc="extra">${t === 'Product' ? `${active.markup.toFixed(1)}%` : money(active.profit)}</div>
        </div>
        <div style="background:rgba(255,255,255,.06);border-radius:10px;padding:10px 11px">
          <div style="font-size:10px;color:#9FBAB2;margin-bottom:3px">${t === 'Product' ? 'Profit / unit' : 'Vs product price'}</div>
          <div class="big-num" style="font-size:16px;color:#EAF0EE" data-calc="compare">${t === 'Product' ? money(active.profit) : money(product.price)}</div>
        </div>
      </div>
      <button class="btn sm mint" data-act="calcAI" style="margin-top:12px">Ask AI to optimize this price</button>
      <button class="btn sm" data-act="calcReset" style="margin-top:8px;background:rgba(255,255,255,.08);color:#EAF0EE">Reset inputs</button>
    </div>` : ''}

    ${t === 'Supply' ? inventoryView() : `
    <div class="card">
      <div class="row-between mb-12"><div style="font-size:13px;font-weight:600">Supply preview</div><span class="tagchip green">Switch to Supply →</span></div>
      <div style="font-size:12px;color:var(--muted);line-height:1.5">Track real inventory — stock, price, size & weight — and let AI predict how many days each item lasts. Open the <b>Supply</b> tab above.</div>
    </div>`}
  </div>
  ${tabbar('calc')}`;
};

export function inventoryView() {
  const items = state.session.inventory || [];
  if (!items.length) {
    return `<div class="card" style="text-align:center;padding:26px 18px">
      <div style="font-size:34px;margin-bottom:8px">📦</div>
      <div style="font-size:15px;font-weight:600;margin-bottom:4px">No inventory yet</div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:16px">Add your products — stock, price, quantity, size and weight — and StatVibe's AI predicts how long each will last.</div>
      <button class="btn" data-act="addItem">+ Add first product</button>
    </div>`;
  }
  const rows = items.map((it) => {
    const pred = state.predictions[it.id];
    const tag = pred && pred.days != null
      ? `<span class="tagchip ${pred.status === 'critical' ? 'amber' : pred.status === 'low' ? 'amber' : 'green'}" style="${pred.status === 'critical' ? 'color:var(--red);background:var(--red-tint)' : ''}">${esc(pred.human || pred.days + ' days')} left</span>`
      : `<span class="tagchip grey">tap to predict</span>`;
    return `
    <div class="card mb-10" data-act="itemMenu" data-id="${it.id}" style="cursor:pointer">
      <div class="row-between" style="align-items:flex-start;margin-bottom:6px">
        <div><div style="font-size:14px;font-weight:600">${esc(it.name)}</div><div style="font-size:11px;color:var(--muted-2)">${[it.sku, it.size, it.weight].filter(Boolean).map(esc).join(' · ') || (it.category ? esc(it.category) : 'product')}</div></div>
        ${tag}
      </div>
      <div class="grid-3" style="margin-top:8px">
        <div><div class="big-num" style="font-size:16px">${Number(it.stock).toLocaleString()}</div><div style="font-size:10px;color:var(--muted-2)">${esc(it.unit || 'in stock')}</div></div>
        <div><div class="big-num" style="font-size:16px">${money(it.price)}</div><div style="font-size:10px;color:var(--muted-2)">price</div></div>
        <div><div class="big-num" style="font-size:16px">${it.ratePerDay || '—'}<span style="font-size:10px;color:var(--muted-2)">/d</span></div><div style="font-size:10px;color:var(--muted-2)">${esc(it.rateBasis || 'sales')}</div></div>
      </div>
      ${pred && pred.note ? `<div class="flex items-center" style="gap:7px;background:var(--teal-tint-2);border:1px solid var(--teal-tint-border);border-radius:9px;padding:8px 10px;margin-top:10px">${I.spark('var(--teal)', 13, true)}<span style="font-size:11.5px;color:var(--teal-deep);line-height:1.4">${esc(pred.note)}</span></div>`
        : `<button class="btn sm outline" data-act="predictItem" data-id="${it.id}" style="margin-top:10px;width:auto;padding:8px 12px">${I.spark('var(--teal)', 12, true)} Predict days left</button>`}
    </div>`;
  }).join('');
  return `<div class="row-between mb-10"><div style="font-size:13px;font-weight:600">Inventory · ${items.length} item${items.length > 1 ? 's' : ''}</div><button class="pill solid" data-act="addItem" style="padding:5px 11px">${I.plus('#fff', 12)} Add</button></div>${rows}`;
}

const IDEA_TAG = { Backlog: 'grey', Building: 'amber', Launched: 'green' };
tabScreens.hub = () => {
  const ideas = state.session.ideas || [];
  const counts = { Backlog: 0, Building: 0, Launched: 0 };
  ideas.forEach((i) => { counts[i.status] = (counts[i.status] || 0) + 1; });
  return `
  <div class="scroll pad">
    <div class="row-between mb-14">
      <div><div class="h-page">Idea Hub</div><div class="sub">${ideas.length} idea${ideas.length === 1 ? '' : 's'} · ${counts.Building} building · ${counts.Launched} launched</div></div>
      <button class="pill solid" data-act="newIdea" style="height:34px">${I.plus('#fff', 14)} New</button>
    </div>
    <div class="card mb-14" style="background:var(--teal-tint-2);border:1px solid var(--teal-tint-border);padding:12px 14px">
      <div class="flex items-center" style="gap:8px;margin-bottom:8px">${I.spark('var(--teal)', 14, true)}<span style="font-size:12.5px;font-weight:600;color:var(--teal-deep)">AIVibe — turn a rough idea into a sharp prompt</span></div>
      <input id="aivibeInput" placeholder="Describe an idea in your own words…" style="width:100%;border:1px solid var(--teal-tint-border);border-radius:9px;padding:10px;font:inherit;font-size:13px;background:var(--surface);color:var(--ink);outline:none" />
      <button class="btn sm" data-act="aivibe" style="margin-top:8px;width:auto;padding:8px 14px">Reformulate with AI →</button>
    </div>
    ${ideas.length ? ideas.map((it) => `
    <div class="card mb-12" data-act="editIdea" data-id="${it.id}" style="cursor:pointer">
      <div class="row-between" style="align-items:flex-start;margin-bottom:8px"><div style="font-size:14px;font-weight:600">${esc(it.title)}</div><span class="tagchip ${IDEA_TAG[it.status] || 'grey'}">${esc(it.status)}</span></div>
      ${it.notes ? `<div style="font-size:12px;color:var(--muted);line-height:1.45">${esc(it.notes)}</div>` : '<div style="font-size:12px;color:var(--muted-3)">No notes yet — tap to edit</div>'}
    </div>`).join('') : `<div class="card" style="text-align:center;padding:24px 18px"><div style="font-size:32px;margin-bottom:8px">💡</div><div style="font-size:15px;font-weight:600;margin-bottom:4px">No ideas yet</div><div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:16px">Capture ideas and notes; edit them anytime, and let AIVibe sharpen them into prompts.</div><button class="btn" data-act="newIdea">+ Add your first idea</button></div>`}
  </div>
  ${tabbar('hub')}`;
};

tabScreens.ai = () => {
  const m = state.models;
  const engineChips = m.engines.map((e) => {
    const on = m.active.has(e.id);
    return `<button class="pill ${on ? 'dark' : ''}" data-act="toggleEngine" data-id="${e.id}"><span class="dot" style="background:${on ? 'var(--mint)' : 'var(--teal)'}"></span>${esc(e.label)}</button>`;
  }).join('');
  const cloudChips = m.cloud.map((c) => {
    if (c.available) {
      const on = m.active.has(c.id);
      return `<button class="pill ${on ? 'dark' : ''}" data-act="toggleEngine" data-id="${c.id}"><span class="dot" style="background:${on ? 'var(--mint)' : 'var(--teal)'}"></span>${esc(c.label)}</button>`;
    }
    return `<button class="pill disabled" data-act="cloudUnavail" data-l="${esc(c.label)}">+ ${esc(c.label)}</button>`;
  }).join('');
  const prefill = state.aiPrefill || 'Draft a Q3 board update from our latest revenue and margin data.';
  return `
  <div class="scroll pad">
    <div class="row-between mb-14">
      <div><div class="h-page">AI Workspace</div><div class="sub">${m.ollamaOnline ? 'Local models · Ollama online' : m.hosted ? 'Hosted AI · live' : 'Simulated engine · start Ollama'} · blend for smarter output</div></div>
      <button class="pill" data-act="aiHistory" style="height:34px">🕘 History${state.session.history && state.session.history.length ? ' · ' + state.session.history.length : ''}</button>
    </div>

    <div class="eyebrow mb-8">Active models</div>
    <div class="flex gap-8 mb-14 flex-wrap">${engineChips}${cloudChips}</div>

    <div class="flex items-center row-between" style="background:var(--teal-tint-2);border:1px solid var(--teal-tint-border);border-radius:12px;padding:11px 13px;margin-bottom:16px">
      <div><div style="font-size:12.5px;font-weight:600;color:var(--teal-deep)">Blend mode</div><div style="font-size:11px;color:var(--muted)">Route each task to the best model automatically</div></div>
      <button class="toggle ${m.blend ? 'on' : ''}" data-act="toggleBlend"></button>
    </div>

    <div class="card mb-14">
      <textarea id="aiPrompt" rows="2" style="width:100%;border:none;outline:none;background:none;font:inherit;font-size:13px;line-height:1.5;resize:none;color:var(--ink)">${esc(prefill)}</textarea>
      <div class="flex items-center gap-8 flex-wrap" style="margin-top:8px">
        <span class="flex items-center" style="gap:5px;font-size:11px;color:var(--muted);background:var(--chip);border-radius:8px;padding:5px 9px">${I.bars('var(--teal)', 12)}Revenue.csv</span>
        <span style="font-size:11px;color:var(--muted);background:var(--chip);border-radius:8px;padding:5px 9px">Margin report</span>
        <button class="iconbtn accent" data-act="runAI" style="margin-left:auto;border-radius:10px">${I.arrow}</button>
      </div>
    </div>

    <div class="eyebrow mb-8">Business tasks</div>
    <div class="grid-2">
      ${[['Business plan', 'From your metrics', 'Write a one-page business plan based on our current revenue, margin and channel mix.'],
         ['Documents', 'Contracts, SOPs', 'Draft a standard operating procedure for fulfilling a wholesale purchase order.'],
         ['Forecast', 'Scenario models', 'Model three revenue scenarios for next quarter (conservative, base, aggressive).'],
         ['Outreach', 'Emails at scale', 'Write a re-engagement email for customers who have not ordered in 60 days.']]
        .map(([t, s, q]) => `<button class="card" data-act="runTask" data-q="${esc(q)}" style="text-align:left;cursor:pointer;padding:12px 13px"><div style="font-size:13px;font-weight:600;margin-bottom:2px">${t}</div><div style="font-size:11px;color:var(--muted-2)">${s}</div></button>`).join('')}
    </div>
  </div>
  ${tabbar('ai')}`;
};

tabScreens.agent = () => {
  const convs = state.session.conversations || [];
  const row = (c) => {
    const preview = (c.mine ? 'You: ' : '') + (c.lastText || 'Say hello 👋');
    const unread = c.unread > 0;
    return `
    <button class="conv-row" data-act="openChat" data-id="${c.id}">
      ${convAvatar(c.other)}
      <div style="flex:1;min-width:0">
        <div class="row-between"><span style="font-size:15px;font-weight:${unread ? '700' : '600'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(c.other.name)}</span><span style="font-size:11.5px;color:${unread ? 'var(--teal)' : 'var(--muted-2)'};flex-shrink:0;margin-left:8px;font-weight:${unread ? '600' : '400'}">${relTime(c.lastAt)}</span></div>
        <div class="row-between" style="margin-top:2px"><span style="font-size:13px;color:${unread ? 'var(--ink)' : 'var(--muted-2)'};font-weight:${unread ? '600' : '400'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(preview)}</span>${unread ? `<span class="conv-badge">${c.unread > 9 ? '9+' : c.unread}</span>` : ''}</div>
      </div>
    </button>`;
  };
  return `
  <div class="scroll pad" style="padding-top:54px">
    <div class="row-between mb-14">
      <div class="h-page">Messages</div>
      <button class="iconbtn accent" data-act="newChat" title="New message">${I.plus('#fff')}</button>
    </div>
    ${convs.length
      ? `<div class="stack" style="gap:2px">${convs.map(row).join('')}</div>`
      : `<div class="card" style="text-align:center;padding:30px 20px;margin-top:20px">
          <div style="width:64px;height:64px;border-radius:20px;background:var(--teal-tint);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:30px">💬</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:6px">No messages yet</div>
          <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:18px">Messages appear when someone scans your StatVibe QR. Share your code, or start one by scanning theirs.</div>
          <button class="btn" data-act="newChat" style="margin-bottom:10px">Start a message</button>
          <button class="btn outline" data-act="myQR">Show my QR code</button>
        </div>`}
  </div>
  ${tabbar('agent')}`;
};

screens.chat = () => {
  const t = state.chat;
  const other = t.other || { name: 'Chat', tag: '' };
  const me = state.session.user && state.session.user.id;
  const auto = state.session.agentAutoReply;
  const bubbles = (t.messages || []).map((m) => m.from === me
    ? `<div class="bubble me">${esc(m.text)}</div>`
    : `<div class="bubble them">${esc(m.text)}</div>`).join('');
  const draftControls = t.draft
    ? `<div class="approve-row"><button class="pill" data-act="approveSend" style="color:var(--teal);background:var(--teal-tint);border-color:var(--teal-tint-border)">Approve &amp; send</button><button class="pill" data-act="editDraft">Edit</button></div>`
    : '';
  return `
  <div class="flex items-center" style="gap:11px;padding:54px 12px 12px;background:var(--surface);border-bottom:1px solid var(--line)">
    <button class="iconbtn plain" data-act="back" style="background:none">${I.back}</button>
    ${convAvatar(other, 36)}
    <div style="flex:1;min-width:0"><div style="font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(other.name)}</div><div style="font-size:11px;color:var(--teal)"><span style="width:6px;height:6px;border-radius:50%;background:${auto ? 'var(--teal)' : 'var(--amber)'};display:inline-block;margin-right:5px"></span>AgentTech · ${auto ? 'auto-reply' : 'approval'}</div></div>
    <button class="iconbtn plain" data-act="agentSettings" title="AgentTech settings"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1Z" stroke="currentColor" stroke-width="1.4"/></svg></button>
  </div>
  <div class="chat-scroll" id="chatScroll">
    ${(t.messages || []).length ? bubbles + draftControls : `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:40px 24px;color:var(--muted-2)"><div style="font-size:13px;line-height:1.5">This is the start of your conversation with <b style="color:var(--ink)">${esc(other.name)}</b>.</div></div>`}
  </div>
  <div class="composer">
    <div class="inputwrap">
      <input id="agentInput" placeholder="Message…" />
      <button class="pill" data-act="agentDraft" style="padding:6px 11px;background:var(--surface)">${I.spark('var(--teal)', 12, true)} AI</button>
      <button class="send" data-act="agentSend">${I.send}</button>
    </div>
  </div>`;
};
