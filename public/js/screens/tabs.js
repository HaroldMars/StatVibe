import { state } from '../state.js';
import { I } from '../icons.js';
import { tabbar } from '../chrome.js';
import {
  esc, money, currency, calcSummary, hasStatInputs, statNum, bizName, userName,
  initials, convAvatar, relTime,
} from '../utils.js';

export const tabScreens = {};
export const screens = {};

export function statsCard() {
  const inv = state.session.inventory || [];
  const s = state.statsDraft || {};
  const revenue = statNum(s.revenue);
  const products = statNum(s.products);
  const avgPrice = statNum(s.avgPrice);
  const hasManual = hasStatInputs();
  if (!hasManual) {
    return `
    <div class="card mb-12" style="text-align:center;padding:28px 20px">
      <div style="font-size:36px;margin-bottom:10px">📊</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px">No business data yet</div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:18px">Enter your key stats first (revenue, products sold, and average price). StatVibe will compute and chart your dashboard after all inputs are complete.</div>
      <div class="field" style="text-align:left;margin-bottom:8px"><label>Revenue (MTD)</label><input id="statsRevenue" inputmode="decimal" placeholder="e.g. 1840000" value="${esc(s.revenue || '')}" /></div>
      <div class="field" style="text-align:left;margin-bottom:8px"><label>Products sold (MTD)</label><input id="statsProducts" inputmode="decimal" placeholder="e.g. 4207" value="${esc(s.products || '')}" /></div>
      <div class="field" style="text-align:left;margin-bottom:16px"><label>Average price</label><input id="statsAvgPrice" inputmode="decimal" placeholder="e.g. 117.38" value="${esc(s.avgPrice || '')}" /></div>
      <button class="btn" data-act="saveStatsInputs">Compute stats</button>
    </div>
    <div class="grid-3 mb-12">
      ${[['Revenue', money(0), '—', 'up'], ['Products', '0', '—', 'up'], ['Avg price', money(0), '—', 'up']]
        .map(([k, v, d]) => `<div class="card" style="padding:11px"><div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:6px">${k}</div><div class="big-num" style="font-size:18px">${v}</div><div style="font-size:10.5px;font-weight:600;margin-top:2px;color:var(--muted-3)">${d}</div></div>`).join('')}
    </div>`;
  }
  const totalStock = products || inv.reduce((sum, i) => sum + (Number(i.stock) || 0), 0);
  const totalValue = revenue;
  const p1 = Math.round(revenue * 0.16);
  const p2 = Math.round(revenue * 0.14);
  const p3 = Math.round(revenue * 0.17);
  const p4 = Math.round(revenue * 0.15);
  const p5 = Math.round(revenue * 0.19);
  const p6 = Math.round(revenue * 0.19);
  const mx = Math.max(p1, p2, p3, p4, p5, p6) || 1;
  const points = [p1, p2, p3, p4, p5, p6].map((v, i) => `${i * 60},${92 - ((v / mx) * 72)}`);
  const first = points[0].split(',');
  const last = points[points.length - 1].split(',');
  const area = `M${first[0]},92 L${points.join(' L')} L${last[0]},92 Z`;
  const cs = calcSummary();
  const askQ = `Analyze my business. Stats: revenue ${money(revenue)}, products sold ${totalStock}, average price ${money(avgPrice)}. Calculator — Retail suggested price ${money(cs.price)} at ${cs.margin.toFixed(1)}% margin (markup ${cs.markup}%), Product landed cost ${money(cs.landed)} (unit ${money(state.calc.unitCost)} + freight ${money(state.calc.freight)} + overhead ${money(state.calc.overhead)}), Supply on hand ${cs.onHand.toLocaleString()} across ${cs.items} SKUs. Give me 3 concrete actions to grow next month.`;
  return `
    <div class="card mb-12" style="padding:16px 16px 14px;cursor:pointer" data-act="goto" data-s="revenue">
      <div class="row-between mb-8">
        <div class="eyebrow">Revenue · MTD</div>
      </div>
      <div class="flex items-center" style="gap:10px;align-items:baseline;margin-bottom:2px">
        <div class="big-num" style="font-size:34px">${money(totalValue)}</div>
      </div>
      <div style="font-size:11.5px;color:var(--muted-2);margin-bottom:6px">${totalStock.toLocaleString()} products sold · Avg ${money(avgPrice)}</div>
      <svg viewBox="0 0 300 100" width="100%" height="92" preserveAspectRatio="none">
        <defs><linearGradient id="svStatsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5865f2" stop-opacity=".22"/><stop offset="1" stop-color="#5865f2" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#svStatsFill)"/>
        <path d="M${points.join(' L')}" fill="none" stroke="#5865f2" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="grid-3 mb-12">
      ${[['Revenue', money(revenue), '', 'up'], ['Products', totalStock.toLocaleString(), '', 'up'], ['Avg price', money(avgPrice), '', 'up']]
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
          <div class="big-num" style="font-size:16px">${money(cs.price)}</div>
          <div style="font-size:10.5px;color:var(--muted-2);margin-top:2px">${cs.margin.toFixed(1)}% margin</div>
        </div>
        <div>
          <div style="font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted-2);font-weight:600;margin-bottom:4px">Product</div>
          <div class="big-num" style="font-size:16px">${money(cs.landed)}</div>
          <div style="font-size:10.5px;color:var(--muted-2);margin-top:2px">Landed cost</div>
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
      <div style="font-size:13.5px;line-height:1.5;color:#D8E4E0">Based on your inputs, you are tracking <b style="color:#fff">${money(revenue)}</b> from <b style="color:#fff">${totalStock.toLocaleString()}</b> sold products, with an average ticket of <b style="color:#fff">${money(avgPrice)}</b>. Calc suggests retail at <b style="color:#fff">${money(cs.price)}</b> (${cs.margin.toFixed(1)}% margin) with supply of <b style="color:#fff">${cs.onHand.toLocaleString()}</b>.</div>
      <div class="insight-actions">
        <button class="btn sm mint" data-act="editStatsInputs">Edit stats</button>
        <button class="btn sm" data-act="askAI" data-q="${esc(askQ)}" style="flex:1;background:rgba(255,255,255,.08);color:#EAF0EE">Ask AI</button>
      </div>
    </div>`;
}

tabScreens.stats = () => `
  <div class="scroll pad-top" style="padding-left:18px;padding-right:18px;padding-bottom:14px">
    <div class="row-between mb-20" style="padding-top:0">
      <div class="flex items-center gap-10">
        <div style="width:34px;height:34px;border-radius:9px;background:#0E7C66;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;letter-spacing:.5px">${initials(bizName())}</div>
        <div>
          <div class="flex items-center" style="gap:5px;font-weight:600;font-size:14px" data-act="goto" data-s="settings">${esc(bizName())} ${I.chevDown}</div>
          <div style="font-size:11px;color:var(--muted-2)">Overview · This month</div>
        </div>
      </div>
      <div class="flex gap-8">
        <button class="iconbtn" data-act="goto" data-s="alerts">${I.bell}</button>
        <button class="iconbtn accent" data-tab="ai">${I.spark('#fff', 16, true)}</button>
        <button class="iconbtn" data-act="goto" data-s="settings" title="Settings & profile" style="background:#0E7C66;border:none;color:#fff;font-weight:700;font-size:12px;letter-spacing:.3px">${initials(userName())}</button>
      </div>
    </div>

    ${statsCard()}
  </div>
  ${tabbar('stats')}`;

tabScreens.calc = () => {
  const c = state.calc;
  const landed = c.unitCost + c.freight + c.overhead;
  const price = landed / (1 - c.markup / 100);
  const margin = ((price - landed) / price) * 100;
  const t = c.tab;
  return `
  <div class="scroll pad">
    <div class="row-between mb-14">
      <div><div class="h-page">Calculator</div><div class="sub">Pricing · Margin · Supply</div></div>
      <button class="iconbtn accent" data-act="addItem" title="Add product">${I.plus('#fff')}</button>
    </div>
    <div class="segmented mb-14" data-seg="calc">
      ${['Retail', 'Product', 'Supply'].map((x) => `<button class="${t === x ? 'active' : ''}" data-v="${x}">${x}</button>`).join('')}
    </div>

    ${t !== 'Supply' ? `
    <div class="card mb-12">
      <div style="font-size:12px;color:var(--muted-2);margin-bottom:10px">Trailhead Jacket · SKU TH-402</div>
      ${[['Unit cost', 'unitCost'], ['Freight + duty', 'freight'], ['Overhead allocation', 'overhead']]
        .map(([lab, key]) => `<div class="row-between" style="padding:9px 0;border-bottom:1px solid var(--hairline)"><span style="font-size:13px">${lab}</span><span class="flex items-center" style="gap:2px"><span class="mono" style="font-size:14px">${esc(currency().symbol)}</span><input class="mono calc-input" data-k="${key}" value="${c[key].toFixed(2)}" inputmode="decimal" style="width:64px;border:none;background:none;text-align:right;font-size:14px;font-weight:500;outline:none;color:var(--ink);border-bottom:1px dashed var(--line-2)"/></span></div>`).join('')}
      <div class="row-between" style="padding:11px 0 2px"><span style="font-size:13px">Target markup</span><span class="flex items-center" style="gap:2px"><input class="mono calc-input" data-k="markup" value="${c.markup}" inputmode="decimal" style="width:44px;border:none;background:none;text-align:right;font-size:14px;font-weight:500;outline:none;color:var(--ink);border-bottom:1px dashed var(--line-2)"/><span class="mono" style="font-size:14px">%</span></span></div>
    </div>

    <div class="card dark mb-12" style="padding:15px 16px">
      <div class="row-between" style="align-items:flex-end;margin-bottom:12px">
        <div><div class="eyebrow" style="color:var(--mint);margin-bottom:4px">Suggested price</div><div class="big-num" style="font-size:32px">${money(price)}</div></div>
        <div style="text-align:right"><div style="font-size:11px;color:#9FBAB2;margin-bottom:4px">Gross margin</div><div class="big-num" style="font-size:24px;color:var(--mint)">${margin.toFixed(1)}%</div></div>
      </div>
      <div class="row-between" style="font-size:11px;color:#9FBAB2;margin-bottom:5px"><span>Landed cost ${money(landed)} · Target margin</span><span>${c.targetMargin}%</span></div>
      <div class="meter" style="background:rgba(255,255,255,.12)"><i style="width:${Math.min(100, margin).toFixed(0)}%;background:var(--mint)"></i></div>
      <button class="btn sm mint" data-act="calcAI" style="margin-top:12px">Ask AI to optimize this price</button>
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
      ${pred && pred.note ? `<div class="flex items-center" style="gap:7px;background:var(--teal-tint-2);border:1px solid var(--teal-tint-border);border-radius:9px;padding:8px 10px;margin-top:10px">${I.spark('#0E7C66', 13, true)}<span style="font-size:11.5px;color:var(--teal-deep);line-height:1.4">${esc(pred.note)}</span></div>`
        : `<button class="btn sm outline" data-act="predictItem" data-id="${it.id}" style="margin-top:10px;width:auto;padding:8px 12px">${I.spark('#0E7C66', 12, true)} Predict days left</button>`}
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
      <div class="flex items-center" style="gap:8px;margin-bottom:8px">${I.spark('#0E7C66', 14, true)}<span style="font-size:12.5px;font-weight:600;color:var(--teal-deep)">AIVibe — turn a rough idea into a sharp prompt</span></div>
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
    return `<button class="pill ${on ? 'dark' : ''}" data-act="toggleEngine" data-id="${e.id}"><span class="dot" style="background:${on ? '#7FE3C8' : '#0E7C66'}"></span>${esc(e.label)}</button>`;
  }).join('');
  const cloudChips = m.cloud.map((c) => {
    if (c.available) {
      const on = m.active.has(c.id);
      return `<button class="pill ${on ? 'dark' : ''}" data-act="toggleEngine" data-id="${c.id}"><span class="dot" style="background:${on ? '#7FE3C8' : '#0E7C66'}"></span>${esc(c.label)}</button>`;
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
      <div><div style="font-size:12.5px;font-weight:600;color:var(--teal-deep)">Blend mode</div><div style="font-size:11px;color:#5C8378">Route each task to the best model automatically</div></div>
      <button class="toggle ${m.blend ? 'on' : ''}" data-act="toggleBlend"></button>
    </div>

    <div class="card mb-14">
      <textarea id="aiPrompt" rows="2" style="width:100%;border:none;outline:none;background:none;font:inherit;font-size:13px;line-height:1.5;resize:none;color:var(--ink)">${esc(prefill)}</textarea>
      <div class="flex items-center gap-8 flex-wrap" style="margin-top:8px">
        <span class="flex items-center" style="gap:5px;font-size:11px;color:var(--muted);background:var(--chip);border-radius:8px;padding:5px 9px">${I.bars('#0E7C66', 12)}Revenue.csv</span>
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
      <button class="pill" data-act="agentDraft" style="padding:6px 11px;background:var(--surface)">${I.spark('#0E7C66', 12, true)} AI</button>
      <button class="send" data-act="agentSend">${I.send}</button>
    </div>
  </div>`;
};
