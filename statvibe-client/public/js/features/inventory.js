import { state } from '../state.js';
import { api } from '../api.js';
import { $, app, currency, esc, money, toast, scheduleAccountPersist } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { render } from '../router.js';
import { I } from '../icons.js';
import { computePricing, computeProduct } from '../calc-math.js';

export function updateCalc() {
  const root = app();
  const card = root.querySelector('[data-calc-result]');
  if (!card) return;
  const active = computePricing(state.calc);
  const product = computeProduct(state.calc);
  const isProduct = state.calc.tab === 'Product';
  const set = (key, text) => { const el = card.querySelector(`[data-calc="${key}"]`); if (el) el.textContent = text; };

  set('price', money(active.price));
  set('margin', `${active.margin.toFixed(1)}%`);
  set('cost-line', `${isProduct ? 'Total product cost' : 'Landed cost'} ${money(active.cost)} · Profit ${money(active.profit)}/unit`);
  set('target-line', isProduct ? `Target ${active.targetMargin}%` : `Markup ${active.markup}%`);
  set('extra', isProduct ? `${active.markup.toFixed(1)}%` : money(active.profit));
  set('compare', isProduct ? money(active.profit) : money(product.price));
  const meter = card.querySelector('[data-calc="meter"]');
  if (meter) meter.style.width = `${Math.min(100, active.margin).toFixed(0)}%`;
}

export function addItemSheet() {
  const sym = currency().symbol;
  openSheet(`<h3>Add product</h3>
    <div class="field" style="margin-top:12px"><label>Product name</label><input id="itName" placeholder="e.g. Rice 5kg"/></div>
    <div class="grid-2"><div class="field"><label>Stock on hand</label><input id="itStock" inputmode="decimal" placeholder="0"/></div><div class="field"><label>Unit</label><input id="itUnit" placeholder="pcs / sacks"/></div></div>
    <div class="grid-2"><div class="field"><label>Price (${esc(sym)})</label><input id="itPrice" inputmode="decimal" placeholder="0"/></div><div class="field"><label>Cost (${esc(sym)})</label><input id="itCost" inputmode="decimal" placeholder="0"/></div></div>
    <div class="grid-2"><div class="field"><label>Size</label><input id="itSize" placeholder="e.g. 5kg / L"/></div><div class="field"><label>Weight</label><input id="itWeight" placeholder="e.g. 5kg"/></div></div>
    <div class="grid-2"><div class="field"><label>Qty / pack</label><input id="itQty" inputmode="decimal" placeholder="1"/></div><div class="field"><label>SKU</label><input id="itSku" placeholder="optional"/></div></div>
    <div class="field"><label>Daily rate — units used or sold per day</label><input id="itRate" inputmode="decimal" placeholder="e.g. 8"/></div>
    <div class="field"><label>Rate basis</label><div class="flex gap-8"><button class="pill solid" data-rate="sales">Sales</button><button class="pill" data-rate="consumption">Consumption</button></div></div>
    <button class="btn" id="itSave">Add to inventory</button>`);
  setTimeout(() => {
    const sd = document.getElementById('sheet'); let basis = 'sales';
    sd.querySelectorAll('[data-rate]').forEach((b) => b.onclick = () => { basis = b.dataset.rate; sd.querySelectorAll('[data-rate]').forEach((x) => x.className = 'pill' + (x.dataset.rate === basis ? ' solid' : '')); });
    const btn = document.getElementById('itSave');
    if (btn) btn.onclick = async () => {
      const g = (id) => (document.getElementById(id) || {}).value;
      const name = (g('itName') || '').trim(); if (!name) { toast('Enter a product name'); return; }
      const { status, data } = await api('/inventory', { method: 'POST', body: { name, stock: g('itStock'), unit: g('itUnit'), price: g('itPrice'), cost: g('itCost'), size: g('itSize'), weight: g('itWeight'), quantity: g('itQty'), sku: g('itSku'), ratePerDay: g('itRate'), rateBasis: basis } });
      if (status === 201) { state.session.inventory.push(data.item); closeSheet(); render(); toast('Added ' + data.item.name); predictItem(data.item.id); }
      else toast(data.error || 'Could not add item');
    };
  }, 30);
}
export async function predictItem(id) {
  state.predictions[id] = { days: null, note: 'Predicting…', status: 'healthy' }; render();
  const { status, data } = await api('/predict', { method: 'POST', body: { itemId: id } });
  if (status === 200) { state.predictions[id] = data; render(); if (data.days == null) toast(data.note); }
  else { delete state.predictions[id]; render(); toast(data.error || 'Prediction failed'); }
}
export function itemMenu(id) {
  const it = (state.session.inventory || []).find((x) => x.id === id); if (!it) return;
  openSheet(`<h3>${esc(it.name)}</h3><div class="sub" style="margin-bottom:14px">${Number(it.stock).toLocaleString()} ${esc(it.unit || 'units')} · ${money(it.price)}</div>
    <button class="btn mb-10" id="imPredict">${I.spark('#fff', 13, true)} Predict days left</button>
    <button class="btn outline mb-10" id="imRestock">Update stock / rate</button>
    <button class="btn outline" id="imDelete" style="color:var(--red)">Delete item</button>`);
  setTimeout(() => {
    const p = document.getElementById('imPredict'); if (p) p.onclick = () => { closeSheet(); predictItem(id); };
    const r = document.getElementById('imRestock'); if (r) r.onclick = () => { closeSheet(); restockSheet(id); };
    const d = document.getElementById('imDelete'); if (d) d.onclick = async () => { closeSheet(); const { status } = await api('/inventory/' + id, { method: 'DELETE' }); if (status === 200) { state.session.inventory = state.session.inventory.filter((x) => x.id !== id); delete state.predictions[id]; render(); toast('Deleted'); } };
  }, 30);
}
export function restockSheet(id) {
  const it = (state.session.inventory || []).find((x) => x.id === id); if (!it) return;
  openSheet(`<h3>Update ${esc(it.name)}</h3>
    <div class="field" style="margin-top:12px"><label>Stock on hand</label><input id="rsStock" inputmode="decimal" value="${it.stock}"/></div>
    <div class="field"><label>Daily rate (${esc(it.rateBasis || 'sales')})</label><input id="rsRate" inputmode="decimal" value="${it.ratePerDay || ''}"/></div>
    <button class="btn" id="rsSave">Save</button>`);
  setTimeout(() => { const b = document.getElementById('rsSave'); if (b) b.onclick = async () => {
    const stock = (document.getElementById('rsStock') || {}).value, rate = (document.getElementById('rsRate') || {}).value;
    const { status, data } = await api('/inventory/' + id, { method: 'PATCH', body: { stock, ratePerDay: rate } });
    if (status === 200) { const i = state.session.inventory.findIndex((x) => x.id === id); state.session.inventory[i] = data.item; delete state.predictions[id]; closeSheet(); render(); toast('Updated'); predictItem(id); }
    else toast(data.error || 'Update failed');
  }; }, 30);
}
