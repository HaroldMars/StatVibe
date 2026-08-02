import { state } from '../state.js';
import { api } from '../api.js';
import { esc, money, toast } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { render } from '../router.js';
import { totalRevenue } from '../revenue-math.js';

/** Apply server revenue payload into session state and re-render. */
export function applyRevenuePayload(data) {
  if (!data) return;
  if (data.account) state.session.account = data.account;
  else if (data.entries && state.session.account) {
    state.session.account = { ...state.session.account, revenueEntries: data.entries };
  }
  if (state.session.account) {
    const total = data.total != null ? data.total : totalRevenue(state.session.account.revenueEntries);
    state.session.account.statsDraft = {
      ...(state.session.account.statsDraft || {}),
      revenue: total > 0 ? String(total) : '',
    };
    state.statsDraft = {
      ...(state.statsDraft || {}),
      revenue: state.session.account.statsDraft.revenue || '',
      products: (state.session.account.statsDraft && state.session.account.statsDraft.products) || state.statsDraft.products || '',
      avgPrice: (state.session.account.statsDraft && state.session.account.statsDraft.avgPrice) || state.statsDraft.avgPrice || '',
    };
  }
}

export function addRevenueSheet() {
  openSheet(`<h3>Add revenue</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 12px">Each amount is a new entry. Your total and chart update automatically.</div>
    <div class="field"><label>Amount</label><input id="revAmount" inputmode="decimal" placeholder="e.g. 2500" autofocus/></div>
    <div class="field"><label>Note (optional)</label><input id="revNote" placeholder="e.g. Walk-in sales"/></div>
    <div class="field"><label>Category (optional)</label><input id="revCat" placeholder="e.g. Retail"/></div>
    <button class="btn" id="revSave">Add entry</button>`);
  setTimeout(() => {
    const btn = document.getElementById('revSave');
    if (!btn) return;
    btn.onclick = async () => {
      const amount = (document.getElementById('revAmount') || {}).value;
      const note = (document.getElementById('revNote') || {}).value;
      const category = (document.getElementById('revCat') || {}).value;
      const { status, data } = await api('/revenue', { method: 'POST', body: { amount, note, category } });
      if (status === 201) {
        applyRevenuePayload(data);
        closeSheet();
        render();
        toast('Revenue added · total ' + money(data.total));
      } else toast((data && data.error) || 'Could not add revenue');
    };
  }, 30);
}

export function editRevenueSheet(id) {
  const entries = (state.session.account && state.session.account.revenueEntries) || [];
  const entry = entries.find((e) => e.id === id);
  if (!entry) { toast('Entry not found'); return; }
  openSheet(`<h3>Edit revenue entry</h3>
    <div class="field" style="margin-top:12px"><label>Amount</label><input id="revAmount" inputmode="decimal" value="${esc(String(entry.amount))}"/></div>
    <div class="field"><label>Note</label><input id="revNote" value="${esc(entry.note || '')}"/></div>
    <div class="field"><label>Category</label><input id="revCat" value="${esc(entry.category || '')}"/></div>
    <button class="btn" id="revSave">Save changes</button>
    <button class="btn outline" id="revDel" style="margin-top:8px;color:var(--red)">Delete entry</button>`);
  setTimeout(() => {
    const save = document.getElementById('revSave');
    const del = document.getElementById('revDel');
    if (save) save.onclick = async () => {
      const amount = (document.getElementById('revAmount') || {}).value;
      const note = (document.getElementById('revNote') || {}).value;
      const category = (document.getElementById('revCat') || {}).value;
      const { status, data } = await api('/revenue/' + encodeURIComponent(id), { method: 'PATCH', body: { amount, note, category } });
      if (status === 200) {
        applyRevenuePayload(data);
        closeSheet();
        render();
        toast('Entry updated');
      } else toast((data && data.error) || 'Could not save');
    };
    if (del) del.onclick = async () => {
      const { status, data } = await api('/revenue/' + encodeURIComponent(id), { method: 'DELETE' });
      if (status === 200) {
        applyRevenuePayload(data);
        closeSheet();
        render();
        toast('Entry deleted');
      } else toast((data && data.error) || 'Could not delete');
    };
  }, 30);
}
