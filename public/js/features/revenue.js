import { state } from '../state.js';
import { api } from '../api.js';
import { esc, money, toast } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { render } from '../router.js';
import { totalRevenue } from '../revenue-math.js';

let lastSubmitAt = 0;
let inFlight = false;

function newClientRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'cr_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Apply server revenue payload into session state and re-render. */
export function applyRevenuePayload(data) {
  if (!data) return;
  if (data.account) state.session.account = data.account;
  else if (data.entries && state.session.account) {
    state.session.account = { ...state.session.account, revenueEntries: data.entries };
  }
  if (state.session.account) {
    const entries = state.session.account.revenueEntries || [];
    const total = data.total != null ? data.total : totalRevenue(entries);
    state.session.account.statsDraft = {
      ...(state.session.account.statsDraft || {}),
      revenue: entries.length ? String(total) : '',
    };
    state.statsDraft = {
      ...(state.statsDraft || {}),
      revenue: state.session.account.statsDraft.revenue || '',
      products: (state.session.account.statsDraft && state.session.account.statsDraft.products) || state.statsDraft.products || '',
      avgPrice: (state.session.account.statsDraft && state.session.account.statsDraft.avgPrice) || state.statsDraft.avgPrice || '',
    };
  }
}

function openEntrySheet({ title, kind = 'sale', entry = null } = {}) {
  const isRefund = kind === 'refund';
  const editing = !!entry;
  const branchList = (state.session.account && state.session.account.branches) || [];
  const branchOpts = [`<option value="">No branch</option>`]
    .concat(branchList.map((b) => `<option value="${esc(b.id)}"${entry && entry.branchId === b.id ? ' selected' : ''}>${esc(b.name)}</option>`))
    .join('');
  openSheet(`<h3>${esc(title)}</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 12px">${
      isRefund
        ? 'Refunds / returns lower your total — the line chart drops in real time (like Stripe net volume).'
        : 'Each sale is a new entry. Edit or refund later and the chart updates live.'
    }</div>
    <div class="field"><label>Amount</label><input id="revAmount" inputmode="decimal" placeholder="e.g. 2500" value="${esc(entry ? String(Math.abs(Number(entry.amount) || 0)) : '')}" autofocus/></div>
    <div class="field"><label>Note (optional)</label><input id="revNote" placeholder="${isRefund ? 'e.g. Returned order #104' : 'e.g. Walk-in sales'}" value="${esc((entry && entry.note) || '')}"/></div>
    <div class="field"><label>Category (optional)</label><input id="revCat" placeholder="e.g. Retail" value="${esc((entry && entry.category) || '')}"/></div>
    <div class="field"><label>Branch</label><select id="revBranch" style="width:100%;font:inherit;font-size:14px;padding:12px 14px;border:1px solid var(--line-2);border-radius:11px;background:var(--surface);color:var(--ink)">${branchOpts}</select></div>
    <div class="field"><label>When</label><input id="revWhen" type="datetime-local" value="${esc(entry && entry.createdAt ? toLocalInput(entry.createdAt) : '')}"/></div>
    <button class="btn" id="revSave">${editing ? 'Save changes' : (isRefund ? 'Log refund' : 'Add sale')}</button>
    ${editing ? '<button class="btn outline" id="revDel" style="margin-top:8px;color:var(--red)">Delete entry</button>' : ''}
    ${!editing ? `<button class="btn outline" id="revOther" style="margin-top:8px">${isRefund ? 'Add a sale instead' : 'Log a refund instead'}</button>` : ''}`);
  setTimeout(() => {
    const save = document.getElementById('revSave');
    const del = document.getElementById('revDel');
    const other = document.getElementById('revOther');
    if (other) other.onclick = () => openEntrySheet({ title: isRefund ? 'Add sale' : 'Log refund', kind: isRefund ? 'sale' : 'refund' });
    if (save) save.onclick = async () => {
      if (inFlight) return;
      const now = Date.now();
      if (!editing && now - lastSubmitAt < 3000) {
        toast('Slow down — duplicate sale blocked');
        return;
      }
      const amount = (document.getElementById('revAmount') || {}).value;
      const note = (document.getElementById('revNote') || {}).value;
      const category = (document.getElementById('revCat') || {}).value;
      const branchId = (document.getElementById('revBranch') || {}).value || '';
      const whenRaw = (document.getElementById('revWhen') || {}).value;
      const body = { amount, note, category, kind: editing ? (Number(amount) < 0 || (entry && entry.kind === 'refund') ? 'refund' : kind) : kind };
      if (branchId) body.branchId = branchId;
      else if (editing) body.branchId = '';
      if (whenRaw) {
        const ts = Date.parse(whenRaw);
        if (Number.isFinite(ts)) body.createdAt = ts;
      }
      if (editing) {
        body.kind = (entry.kind === 'refund' || isRefund) ? 'refund' : (entry.kind === 'adjustment' ? 'adjustment' : 'sale');
        if (isRefund) body.kind = 'refund';
      } else {
        body.clientRequestId = newClientRequestId();
      }
      inFlight = true;
      save.disabled = true;
      save.textContent = 'Saving…';
      lastSubmitAt = now;
      let status; let data;
      try {
        if (editing) {
          ({ status, data } = await api('/revenue/' + encodeURIComponent(entry.id), { method: 'PATCH', body }));
        } else {
          ({ status, data } = await api('/revenue', { method: 'POST', body }));
        }
      } finally {
        inFlight = false;
        if (save) { save.disabled = false; save.textContent = editing ? 'Save changes' : (isRefund ? 'Log refund' : 'Add sale'); }
      }
      if (status === 201 || status === 200) {
        applyRevenuePayload(data);
        closeSheet();
        render();
        const t = data.total;
        toast(data.deduped
          ? 'Duplicate ignored · total ' + money(t)
          : (editing ? 'Entry updated · total ' + money(t) : (isRefund ? 'Refund logged · total ' + money(t) : 'Sale added · total ' + money(t))));
      } else toast((data && data.error) || 'Could not save');
    };
    if (del && entry) del.onclick = async () => {
      if (!confirm('Delete this transaction? Net revenue will update immediately.')) return;
      const { status, data } = await api('/revenue/' + encodeURIComponent(entry.id), { method: 'DELETE' });
      if (status === 200) {
        applyRevenuePayload(data);
        closeSheet();
        render();
        toast('Entry deleted · total ' + money(data.total));
      } else toast((data && data.error) || 'Could not delete');
    };
  }, 30);
}

function toLocalInput(ts) {
  const d = new Date(Number(ts) || Date.now());
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function addRevenueSheet() {
  openEntrySheet({ title: 'Add sale', kind: 'sale' });
}

export function addRefundSheet() {
  openEntrySheet({ title: 'Log refund', kind: 'refund' });
}

export function editRevenueSheet(id) {
  const entries = (state.session.account && state.session.account.revenueEntries) || [];
  const entry = entries.find((e) => e.id === id);
  if (!entry) { toast('Entry not found'); return; }
  const isRefund = entry.kind === 'refund' || Number(entry.amount) < 0;
  openEntrySheet({
    title: isRefund ? 'Edit refund' : 'Edit sale',
    kind: isRefund ? 'refund' : 'sale',
    entry,
  });
}
