import { state } from '../state.js';
import { api } from '../api.js';
import { esc, toast, money, bizName } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { render } from '../router.js';
import { I } from '../icons.js';

let leafletReady = null;
let mapInstance = null;
let pinLayer = null;
let pendingDrop = null; // { lat, lng } while wizard open

function branches() {
  return (state.session.account && state.session.account.branches) || [];
}

function applyBranches(data) {
  if (!data) return;
  if (data.account) state.session.account = data.account;
  else if (data.branches && state.session.account) {
    state.session.account = { ...state.session.account, branches: data.branches };
  }
}

export async function loadBranches() {
  const { status, data } = await api('/branches');
  if (status === 200) applyBranches(data);
}

function ensureLeaflet() {
  if (leafletReady) return leafletReady;
  leafletReady = new Promise((resolve, reject) => {
    if (window.L) return resolve(window.L);
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = () => reject(new Error('Leaflet failed to load'));
    document.head.appendChild(s);
  });
  return leafletReady;
}

function healthColor(status) {
  if (status === 'critical') return '#EF4444';
  if (status === 'low') return '#F59E0B';
  return '#10B981';
}

function pinHtml(branch) {
  const c = healthColor(branch.supplyStatus || 'healthy');
  const initial = (branch.name || '?').trim().charAt(0).toUpperCase();
  return `<div class="sv-pin" data-id="${esc(branch.id)}">
    <div class="sv-pin-shadow"></div>
    <div class="sv-pin-pulse" style="--pin-c:${c}"></div>
    <div class="sv-pin-badge">${esc(initial)}</div>
  </div>`;
}

function destroyMap() {
  if (mapInstance) {
    try { mapInstance.remove(); } catch { /* ignore */ }
    mapInstance = null;
    pinLayer = null;
  }
}

export function mapTabHtml() {
  const list = branches();
  return `
  <div class="map-shell">
    <div class="map-topbar glass-bar">
      <div>
        <div class="h-page" style="font-size:18px;margin:0">Branches</div>
        <div class="sub" style="margin:0">${list.length} location${list.length === 1 ? '' : 's'} · ${esc(bizName() || 'workspace')}</div>
      </div>
      <button class="pill solid" data-act="addBranch" style="height:34px">${I.plus('#fff', 14)} Add</button>
    </div>
    <div class="map-search glass-bar">
      <input id="mapGeoQ" placeholder="Search city or address…" />
      <button class="btn sm" data-act="mapGeocode" style="width:auto;padding:8px 12px">Go</button>
    </div>
    <div class="map-viewport">
      <div class="map-iso">
        <div id="svBranchMap" class="sv-branch-map"></div>
      </div>
    </div>
    <div class="map-hint glass-bar">Tap the map to drop a pin · tap a pin for live metrics</div>
  </div>`;
}

export async function initBranchMap() {
  const el = document.getElementById('svBranchMap');
  if (!el) return;
  destroyMap();
  try {
    const L = await ensureLeaflet();
    mapInstance = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView([14.5995, 120.9842], 11);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(mapInstance);

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);
    pinLayer = L.layerGroup().addTo(mapInstance);

    mapInstance.on('click', (e) => {
      pendingDrop = { lat: e.latlng.lat, lng: e.latlng.lng };
      openBranchWizard({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    renderPins();
    const list = branches();
    if (list.length) {
      const bounds = L.latLngBounds(list.map((b) => [b.lat, b.lng]));
      mapInstance.fitBounds(bounds.pad(0.25));
    }
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 80);
  } catch (err) {
    el.innerHTML = `<div style="padding:24px;color:var(--muted);text-align:center">Map failed to load. Check your connection.</div>`;
  }
}

function renderPins() {
  if (!mapInstance || !pinLayer || !window.L) return;
  pinLayer.clearLayers();
  const L = window.L;
  for (const b of branches()) {
    const icon = L.divIcon({
      className: 'sv-pin-wrap',
      html: pinHtml(b),
      iconSize: [44, 56],
      iconAnchor: [22, 50],
    });
    const m = L.marker([b.lat, b.lng], { icon });
    m.on('click', (ev) => {
      L.DomEvent.stopPropagation(ev);
      openBranchDrawer(b.id);
    });
    pinLayer.addLayer(m);
  }
}

export async function geocodeAndFly() {
  const q = ((document.getElementById('mapGeoQ') || {}).value || '').trim();
  if (!q) { toast('Enter an address or city'); return; }
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const rows = await r.json();
    if (!rows || !rows[0]) { toast('No results for that place'); return; }
    const lat = Number(rows[0].lat);
    const lng = Number(rows[0].lon);
    const address = rows[0].display_name || q;
    if (mapInstance) mapInstance.flyTo([lat, lng], 14, { duration: 1.1 });
    pendingDrop = { lat, lng, address };
    openBranchWizard({ lat, lng, address });
  } catch {
    toast('Geocoding unavailable offline');
  }
}

export function openBranchWizard(seed = {}) {
  const lat = seed.lat != null ? seed.lat : (pendingDrop && pendingDrop.lat);
  const lng = seed.lng != null ? seed.lng : (pendingDrop && pendingDrop.lng);
  const address = seed.address || (pendingDrop && pendingDrop.address) || '';
  openSheet(`<h3>Add branch</h3>
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 12px">Set up this location — name, supply thresholds, and who can see the pin.</div>
    <div class="field"><label>Branch name</label><input id="brName" placeholder="e.g. Downtown Floor" autofocus/></div>
    <div class="field"><label>Address</label><input id="brAddr" placeholder="Street, city" value="${esc(address)}"/></div>
    <div class="grid-2" style="gap:10px">
      <div class="field"><label>Initial stock level</label><input id="brStock" inputmode="numeric" placeholder="e.g. 120" value="100"/></div>
      <div class="field"><label>Low-stock threshold</label><input id="brThr" inputmode="numeric" placeholder="e.g. 25" value="25"/></div>
    </div>
    <div class="field"><label>Visibility</label>
      <div class="flex gap-8 flex-wrap" id="brVis">
        <button class="pill solid" data-vis="private">Private</button>
        <button class="pill" data-vis="public">Public</button>
        <button class="pill" data-vis="shared">Shared</button>
      </div>
    </div>
    <div class="field" id="brShareWrap" style="display:none"><label>Share with (emails, comma-separated)</label><input id="brShare" placeholder="ops@team.com"/></div>
    <div style="font-size:11px;color:var(--muted-2);margin-bottom:10px">Pin at ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}</div>
    <button class="btn" id="brSave">Save branch</button>`);
  let vis = 'private';
  setTimeout(() => {
    const wrap = document.getElementById('brVis');
    const shareWrap = document.getElementById('brShareWrap');
    if (wrap) wrap.querySelectorAll('[data-vis]').forEach((b) => {
      b.onclick = () => {
        vis = b.dataset.vis;
        wrap.querySelectorAll('[data-vis]').forEach((x) => x.classList.toggle('solid', x.dataset.vis === vis));
        if (shareWrap) shareWrap.style.display = vis === 'shared' ? '' : 'none';
      };
    });
    const save = document.getElementById('brSave');
    if (save) save.onclick = async () => {
      if (save.disabled) return;
      save.disabled = true;
      const name = (document.getElementById('brName') || {}).value;
      const body = {
        name,
        address: (document.getElementById('brAddr') || {}).value,
        lat, lng,
        stockLevel: (document.getElementById('brStock') || {}).value,
        stockThreshold: (document.getElementById('brThr') || {}).value,
        visibility: vis,
        sharedWith: String((document.getElementById('brShare') || {}).value || '').split(',').map((s) => s.trim()).filter(Boolean),
        dailyRevenue: 0,
        staffCount: 1,
      };
      const { status, data } = await api('/branches', { method: 'POST', body });
      save.disabled = false;
      if (status === 201) {
        applyBranches(data);
        closeSheet();
        pendingDrop = null;
        render();
        setTimeout(() => { initBranchMap(); }, 40);
        toast('Branch added');
      } else toast((data && data.error) || 'Could not save branch');
    };
  }, 30);
}

export function openBranchDrawer(id) {
  const b = branches().find((x) => x.id === id);
  if (!b) { toast('Branch not found'); return; }
  const c = healthColor(b.supplyStatus);
  const statusLabel = b.supplyStatus === 'critical' ? 'Critical alert' : b.supplyStatus === 'low' ? 'Low stock' : 'Healthy';
  openSheet(`<h3>${esc(b.name)}</h3>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">${esc(b.address || 'No address')} · ${esc(b.visibility)}</div>
    <div class="grid-2" style="gap:10px;margin-bottom:12px">
      <div class="card" style="padding:12px"><div class="eyebrow">Stock</div><div class="big-num" style="font-size:22px">${Number(b.stockLevel) || 0}</div><div style="font-size:11px;color:${c};font-weight:600;margin-top:4px">${statusLabel}</div></div>
      <div class="card" style="padding:12px"><div class="eyebrow">Daily revenue</div><div class="big-num" style="font-size:22px">${money(b.dailyRevenue || 0)}</div><div style="font-size:11px;color:var(--muted-2);margin-top:4px">Threshold ${Number(b.stockThreshold) || 0}</div></div>
    </div>
    <div class="card mb-12" style="padding:12px">
      <div class="row-between"><span style="font-size:13px;font-weight:600">Staff / clients</span><span class="val">${Number(b.staffCount) || 0} active</span></div>
      <div class="row-between" style="margin-top:8px"><span style="font-size:13px;font-weight:600">Coords</span><span class="val">${Number(b.lat).toFixed(4)}, ${Number(b.lng).toFixed(4)}</span></div>
    </div>
    <div class="field"><label>Visibility</label>
      <div class="flex gap-8 flex-wrap" id="brVisEdit">
        ${['private', 'public', 'shared'].map((v) => `<button class="pill${b.visibility === v ? ' solid' : ''}" data-vis="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}
      </div>
    </div>
    <button class="btn" id="brCopilot">Ask AI copilot about this branch</button>
    <button class="btn outline" id="brDelete" style="margin-top:8px;color:var(--red)">Delete branch</button>`);
  setTimeout(() => {
    let vis = b.visibility || 'private';
    const wrap = document.getElementById('brVisEdit');
    if (wrap) wrap.querySelectorAll('[data-vis]').forEach((btn) => {
      btn.onclick = async () => {
        vis = btn.dataset.vis;
        wrap.querySelectorAll('[data-vis]').forEach((x) => x.classList.toggle('solid', x.dataset.vis === vis));
        const { status, data } = await api('/branches/' + encodeURIComponent(b.id), { method: 'PATCH', body: { visibility: vis } });
        if (status === 200) { applyBranches(data); toast('Visibility → ' + vis); renderPins(); }
        else toast((data && data.error) || 'Update failed');
      };
    });
    const del = document.getElementById('brDelete');
    if (del) del.onclick = async () => {
      if (!confirm('Delete branch “' + b.name + '”?')) return;
      const { status, data } = await api('/branches/' + encodeURIComponent(b.id), { method: 'DELETE' });
      if (status === 200) {
        applyBranches(data);
        closeSheet();
        render();
        setTimeout(() => initBranchMap(), 40);
        toast('Branch deleted');
      } else toast((data && data.error) || 'Could not delete');
    };
    const copilot = document.getElementById('brCopilot');
    if (copilot) copilot.onclick = () => {
      closeSheet();
      const q = `You are the StatVibe branch copilot. Analyze branch "${b.name}" at ${b.address || 'unknown address'}. Current stock ${b.stockLevel}, low-stock threshold ${b.stockThreshold}, status ${b.supplyStatus}, daily revenue ${b.dailyRevenue}, staff ${b.staffCount}. Detect anomalies and suggest restock actions with urgency.`;
      state.aiPrefill = q;
      state.tab = 'ai';
      state.stack = [];
      render();
      toast('Copilot prompt ready in AI Workspace');
    };
  }, 30);
}

export function teardownBranchMap() {
  destroyMap();
}
