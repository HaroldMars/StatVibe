import { state } from '../state.js';
import { api } from '../api.js';
import { esc, toast, money, bizName } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { render } from '../router.js';
import { tabbar } from '../chrome.js';
import { I } from '../icons.js';

let leafletReady = null;
let mapInstance = null;
let pinLayer = null;
let tempMarker = null;
let lastView = null;
let sheetMode = null; // 'wizard' | 'drawer' | null

export function ensureMapUi() {
  if (!state.mapUi) {
    state.mapUi = { fullscreen: false, mode: 'browse', pending: null, drawerId: null };
  }
  return state.mapUi;
}

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

function healthLabel(status) {
  if (status === 'critical') return 'Alert';
  if (status === 'low') return 'Low stock';
  return 'Normal';
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

function tempPinHtml() {
  return `<div class="sv-pin sv-pin-temp">
    <div class="sv-pin-shadow"></div>
    <div class="sv-pin-pulse" style="--pin-c:#8B5CF6"></div>
    <div class="sv-pin-badge">+</div>
  </div>`;
}

function parseCoord(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).trim());
  return Number.isFinite(n) ? n : NaN;
}

function rememberView() {
  if (!mapInstance) return;
  const c = mapInstance.getCenter();
  lastView = { center: [c.lat, c.lng], zoom: mapInstance.getZoom() };
}

function destroyMap() {
  rememberView();
  clearTempMarker();
  if (mapInstance) {
    try { mapInstance.remove(); } catch { /* ignore */ }
    mapInstance = null;
    pinLayer = null;
  }
}

function clearTempMarker() {
  if (tempMarker && mapInstance) {
    try { mapInstance.removeLayer(tempMarker); } catch { /* ignore */ }
  }
  tempMarker = null;
}

function sheetBackHeader(title) {
  return `<div class="sheet-back-row">
    <button type="button" class="sheet-back-btn" id="sheetLogicalBack">${I.back} Back</button>
    <h3 style="margin:0;flex:1;text-align:center;padding-right:56px">${esc(title)}</h3>
  </div>`;
}

function wireSheetBack() {
  const btn = document.getElementById('sheetLogicalBack');
  if (btn) btn.onclick = () => { logicalBack(); };
}

function directoryHtml() {
  const list = branches();
  if (!list.length) {
    return `<div class="map-dir-empty">
      <div style="font-size:14px;font-weight:600;margin-bottom:4px">No branches yet</div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.45;margin-bottom:12px">Tap the map or search an address to drop a pin, verify the location, then save.</div>
      <button class="btn sm" data-act="addBranch" style="width:auto;padding:8px 14px">Drop a pin at map center</button>
    </div>`;
  }
  return list.map((b) => {
    const c = healthColor(b.supplyStatus);
    return `<div class="map-dir-card" data-act="focusBranch" data-id="${esc(b.id)}">
      <div class="map-dir-main">
        <div class="map-dir-dot" style="background:${c}" title="${esc(healthLabel(b.supplyStatus))}"></div>
        <div class="map-dir-copy">
          <div class="map-dir-name">${esc(b.name)}</div>
          <div class="map-dir-meta">${esc(b.address || `${Number(b.lat).toFixed(3)}, ${Number(b.lng).toFixed(3)}`)} · stock ${Number(b.stockLevel) || 0}</div>
          <div class="map-dir-status" style="color:${c}">${esc(healthLabel(b.supplyStatus))} · ${esc(b.visibility || 'private')}</div>
        </div>
      </div>
      <div class="map-dir-actions">
        <button type="button" class="pill" data-act="openBranch" data-id="${esc(b.id)}">View</button>
        <button type="button" class="pill" data-act="editBranch" data-id="${esc(b.id)}">Edit</button>
        <button type="button" class="pill" data-act="deleteBranch" data-id="${esc(b.id)}" style="color:var(--red)">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function refreshDirectory() {
  const el = document.getElementById('mapDirList');
  if (el) el.innerHTML = directoryHtml();
}

export function mapTabHtml() {
  ensureMapUi();
  const list = branches();
  const fs = !!state.mapUi.fullscreen;
  return `
  <div class="map-shell ${fs ? 'is-fullscreen' : 'is-split'}">
    <div class="map-pane">
      <div class="map-topbar glass-bar">
        <div class="flex items-center gap-8" style="min-width:0">
          <button type="button" class="iconbtn plain map-logical-back" data-act="logicalBack" title="Back" aria-label="Back">${I.back}</button>
          <div style="min-width:0">
            <div class="h-page" style="font-size:17px;margin:0">Branches</div>
            <div class="sub" style="margin:0">${list.length} location${list.length === 1 ? '' : 's'} · ${esc(bizName() || 'workspace')}</div>
          </div>
        </div>
        <button class="pill solid" data-act="addBranch" style="height:34px;flex-shrink:0">${I.plus('#fff', 14)} Add</button>
      </div>
      <div class="map-search glass-bar">
        <input id="mapGeoQ" placeholder="Search city or address…" />
        <button class="btn sm" data-act="mapGeocode" style="width:auto;padding:8px 12px">Go</button>
      </div>
      <div class="map-viewport">
        <button type="button" class="map-fs-toggle glass-bar" data-act="mapToggleFs">${fs ? 'Exit' : 'Fullscreen'}</button>
        <div class="map-iso">
          <div id="svBranchMap" class="sv-branch-map"></div>
        </div>
        <div id="mapVerifyCard" class="map-verify glass-bar" hidden></div>
      </div>
    </div>
    <div class="map-directory">
      <div class="map-dir-head">
        <div class="eyebrow" style="margin:0">Branch directory</div>
        <div style="font-size:11px;color:var(--muted-2)">Tap a row to fly to pin</div>
      </div>
      <div id="mapDirList" class="map-dir-list">${directoryHtml()}</div>
    </div>
    ${fs ? `<button type="button" class="map-exit-fs glass-bar" data-act="mapToggleFs">${I.back} Exit fullscreen</button>` : ''}
  </div>
  ${fs ? '' : tabbar('map')}`;
}

export async function initBranchMap() {
  const el = document.getElementById('svBranchMap');
  if (!el) return;
  destroyMap();
  try {
    const L = await ensureLeaflet();
    const start = lastView || { center: [14.5995, 120.9842], zoom: 11 };
    mapInstance = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    }).setView(start.center, start.zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(mapInstance);

    // Zoom +/- controls hidden — pinch / double-tap / scroll zoom still work
    pinLayer = L.layerGroup().addTo(mapInstance);

    mapInstance.on('click', (e) => {
      beginPinDrop({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    renderPins();
    const list = branches();
    if (!lastView && list.length) {
      const bounds = L.latLngBounds(list.map((b) => [b.lat, b.lng]));
      mapInstance.fitBounds(bounds.pad(0.25));
    }

    const ui = ensureMapUi();
    if (ui.pending && ui.mode === 'verify') {
      placeTempPin(ui.pending.lat, ui.pending.lng);
      showVerifyCard(ui.pending);
    }

    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 80);
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 320);
  } catch {
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

function placeTempPin(lat, lng) {
  if (!mapInstance || !window.L) return;
  clearTempMarker();
  const L = window.L;
  const icon = L.divIcon({
    className: 'sv-pin-wrap',
    html: tempPinHtml(),
    iconSize: [44, 56],
    iconAnchor: [22, 50],
  });
  tempMarker = L.marker([lat, lng], { icon, zIndexOffset: 900 }).addTo(mapInstance);
}

function hideVerifyCard() {
  const card = document.getElementById('mapVerifyCard');
  if (card) {
    card.hidden = true;
    card.innerHTML = '';
  }
}

function showVerifyCard(pending) {
  const card = document.getElementById('mapVerifyCard');
  if (!card || !pending) return;
  const label = pending.address
    || `${parseCoord(pending.lat).toFixed(5)}, ${parseCoord(pending.lng).toFixed(5)}`;
  card.hidden = false;
  card.innerHTML = `
    <div class="map-verify-title">Verify location</div>
    <div class="map-verify-addr">${esc(label)}</div>
    <div class="map-verify-coords">${parseCoord(pending.lat).toFixed(5)}, ${parseCoord(pending.lng).toFixed(5)}</div>
    <div class="map-verify-actions">
      <button type="button" class="btn outline sm" id="mapVerifyCancel" style="width:auto;padding:8px 12px">Cancel</button>
      <button type="button" class="btn sm" id="mapVerifyOk" style="width:auto;padding:8px 12px">Confirm pin</button>
    </div>`;
  const cancel = document.getElementById('mapVerifyCancel');
  const ok = document.getElementById('mapVerifyOk');
  if (cancel) cancel.onclick = () => cancelPinning();
  if (ok) ok.onclick = () => confirmPinAndOpenWizard();
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const d = await r.json();
    return (d && d.display_name) || '';
  } catch {
    return '';
  }
}

export async function beginPinDrop({ lat, lng, address } = {}) {
  const la = parseCoord(lat);
  const ln = parseCoord(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) {
    toast('Invalid map coordinates');
    return;
  }
  const ui = ensureMapUi();
  ui.mode = 'verify';
  ui.pending = { lat: la, lng: ln, address: address || '' };
  placeTempPin(la, ln);
  if (mapInstance) mapInstance.flyTo([la, ln], Math.max(mapInstance.getZoom(), 14), { duration: 0.7 });
  showVerifyCard(ui.pending);
  if (!address) {
    const addr = await reverseGeocode(la, ln);
    if (ui.pending && ui.pending.lat === la && ui.pending.lng === ln && addr) {
      ui.pending.address = addr;
      showVerifyCard(ui.pending);
    }
  }
}

export function cancelPinning() {
  const ui = ensureMapUi();
  ui.mode = 'browse';
  ui.pending = null;
  clearTempMarker();
  hideVerifyCard();
}

function confirmPinAndOpenWizard() {
  const ui = ensureMapUi();
  if (!ui.pending) {
    toast('Drop a pin on the map first');
    return;
  }
  hideVerifyCard();
  openBranchWizard(ui.pending);
}

export function toggleMapFullscreen() {
  const ui = ensureMapUi();
  rememberView();
  ui.fullscreen = !ui.fullscreen;
  const shell = document.querySelector('.map-shell');
  const screen = document.querySelector('#app .screen');
  if (shell && screen && state.tab === 'map' && !state.stack.length) {
    shell.classList.toggle('is-fullscreen', ui.fullscreen);
    shell.classList.toggle('is-split', !ui.fullscreen);
    let exit = shell.querySelector('.map-exit-fs');
    if (ui.fullscreen && !exit) {
      exit = document.createElement('button');
      exit.type = 'button';
      exit.className = 'map-exit-fs glass-bar';
      exit.setAttribute('data-act', 'mapToggleFs');
      exit.innerHTML = `${I.back} Exit fullscreen`;
      shell.appendChild(exit);
    } else if (!ui.fullscreen && exit) {
      exit.remove();
    }
    const tab = screen.querySelector('.tabbar');
    if (tab) tab.style.display = ui.fullscreen ? 'none' : '';
    const fsBtn = shell.querySelector('.map-fs-toggle');
    if (fsBtn) fsBtn.textContent = ui.fullscreen ? 'Exit' : 'Fullscreen';
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 60);
    setTimeout(() => mapInstance && mapInstance.invalidateSize(), 280);
    return;
  }
  render();
}

export async function geocodeAndFly() {
  const q = ((document.getElementById('mapGeoQ') || {}).value || '').trim();
  if (!q) { toast('Enter an address or city'); return; }
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const rows = await r.json();
    if (!rows || !rows[0]) { toast('No results for that place'); return; }
    const lat = parseCoord(rows[0].lat);
    const lng = parseCoord(rows[0].lon);
    const address = rows[0].display_name || q;
    await beginPinDrop({ lat, lng, address });
  } catch {
    toast('Geocoding unavailable offline');
  }
}

export function dropPinAtCenter() {
  if (mapInstance) {
    const c = mapInstance.getCenter();
    beginPinDrop({ lat: c.lat, lng: c.lng });
    return;
  }
  beginPinDrop({ lat: 14.5995, lng: 120.9842 });
}

export function focusBranch(id) {
  const b = branches().find((x) => x.id === id);
  if (!b) { toast('Branch not found'); return; }
  if (mapInstance) {
    mapInstance.flyTo([b.lat, b.lng], 15, { duration: 0.85 });
  }
}

export function openBranchWizard(seed = {}) {
  const ui = ensureMapUi();
  const lat = parseCoord(seed.lat != null ? seed.lat : (ui.pending && ui.pending.lat));
  const lng = parseCoord(seed.lng != null ? seed.lng : (ui.pending && ui.pending.lng));
  const address = seed.address || (ui.pending && ui.pending.address) || '';
  const editing = seed.id ? branches().find((x) => x.id === seed.id) : null;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    toast('Pick a location on the map first');
    return;
  }

  ui.pending = { lat, lng, address, id: editing ? editing.id : null };
  ui.mode = 'wizard';
  sheetMode = 'wizard';
  placeTempPin(lat, lng);

  openSheet(`${sheetBackHeader(editing ? 'Edit branch' : 'Add branch')}
    <div style="font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 12px">Confirm details — name, supply thresholds, and who can see the pin.</div>
    <div class="field"><label>Branch name</label><input id="brName" placeholder="e.g. Downtown Floor" value="${esc(editing ? editing.name : '')}" autofocus/></div>
    <div class="field"><label>Address</label><input id="brAddr" placeholder="Street, city" value="${esc(address || (editing && editing.address) || '')}"/></div>
    <div class="grid-2" style="gap:10px">
      <div class="field"><label>Initial stock level</label><input id="brStock" inputmode="decimal" placeholder="e.g. 120" value="${esc(String(editing ? editing.stockLevel : 100))}"/></div>
      <div class="field"><label>Low-stock threshold</label><input id="brThr" inputmode="decimal" placeholder="e.g. 25" value="${esc(String(editing ? editing.stockThreshold : 25))}"/></div>
    </div>
    <div class="field"><label>Visibility</label>
      <div class="flex gap-8 flex-wrap" id="brVis">
        <button type="button" class="pill solid" data-vis="private">Private</button>
        <button type="button" class="pill" data-vis="public">Public</button>
        <button type="button" class="pill" data-vis="shared">Shared</button>
      </div>
    </div>
    <div class="field" id="brShareWrap" style="display:none"><label>Share with (emails, comma-separated)</label><input id="brShare" placeholder="ops@team.com" value="${esc(((editing && editing.sharedWith) || []).join(', '))}"/></div>
    <div style="font-size:11px;color:var(--muted-2);margin-bottom:10px">Pin at ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
    <button type="button" class="btn" id="brSave">${editing ? 'Save changes' : 'Save branch'}</button>`);

  let vis = (editing && editing.visibility) || 'private';
  setTimeout(() => {
    wireSheetBack();
    const wrap = document.getElementById('brVis');
    const shareWrap = document.getElementById('brShareWrap');
    if (wrap) {
      wrap.querySelectorAll('[data-vis]').forEach((b) => {
        b.classList.toggle('solid', b.dataset.vis === vis);
        b.onclick = () => {
          vis = b.dataset.vis;
          wrap.querySelectorAll('[data-vis]').forEach((x) => x.classList.toggle('solid', x.dataset.vis === vis));
          if (shareWrap) shareWrap.style.display = vis === 'shared' ? '' : 'none';
        };
      });
      if (shareWrap) shareWrap.style.display = vis === 'shared' ? '' : 'none';
    }
    const save = document.getElementById('brSave');
    if (save) save.onclick = async () => {
      if (save.disabled) return;
      const name = String((document.getElementById('brName') || {}).value || '').trim();
      if (!name) { toast('Enter a branch name'); return; }
      const latN = parseCoord((ui.pending && ui.pending.lat) != null ? ui.pending.lat : lat);
      const lngN = parseCoord((ui.pending && ui.pending.lng) != null ? ui.pending.lng : lng);
      if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
        toast('Coordinates missing — drop a pin again');
        return;
      }
      if (latN < -90 || latN > 90 || lngN < -180 || lngN > 180) {
        toast('Coordinates out of range');
        return;
      }
      save.disabled = true;
      save.textContent = 'Saving…';
      const body = {
        name,
        address: String((document.getElementById('brAddr') || {}).value || '').trim(),
        lat: latN,
        lng: lngN,
        stockLevel: parseFloat(String((document.getElementById('brStock') || {}).value || '0')) || 0,
        stockThreshold: parseFloat(String((document.getElementById('brThr') || {}).value || '0')) || 0,
        visibility: vis,
        sharedWith: String((document.getElementById('brShare') || {}).value || '').split(',').map((s) => s.trim()).filter(Boolean),
        dailyRevenue: editing ? (Number(editing.dailyRevenue) || 0) : 0,
        staffCount: editing ? (Number(editing.staffCount) || 1) : 1,
      };
      let status; let data;
      try {
        if (editing) {
          ({ status, data } = await api('/branches/' + encodeURIComponent(editing.id), { method: 'PATCH', body }));
        } else {
          ({ status, data } = await api('/branches', { method: 'POST', body }));
        }
      } catch (err) {
        save.disabled = false;
        save.textContent = editing ? 'Save changes' : 'Save branch';
        toast('Network error — could not save branch');
        return;
      }
      save.disabled = false;
      save.textContent = editing ? 'Save changes' : 'Save branch';
      if (status === 201 || status === 200) {
        applyBranches(data);
        closeSheet();
        sheetMode = null;
        cancelPinning();
        refreshDirectory();
        renderPins();
        toast(editing ? 'Branch updated' : 'Branch saved successfully');
      } else {
        toast((data && data.error) || 'Could not save branch — check name and location');
      }
    };
  }, 30);
}

export function openBranchDrawer(id) {
  const b = branches().find((x) => x.id === id);
  if (!b) { toast('Branch not found'); return; }
  const ui = ensureMapUi();
  ui.drawerId = id;
  ui.mode = 'drawer';
  sheetMode = 'drawer';
  const c = healthColor(b.supplyStatus);
  const statusLabel = healthLabel(b.supplyStatus);
  openSheet(`${sheetBackHeader(b.name)}
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
        ${['private', 'public', 'shared'].map((v) => `<button type="button" class="pill${b.visibility === v ? ' solid' : ''}" data-vis="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}
      </div>
    </div>
    <button type="button" class="btn" id="brCopilot">Ask AI copilot about this branch</button>
    <button type="button" class="btn outline" id="brEdit" style="margin-top:8px">Edit branch</button>
    <button type="button" class="btn outline" id="brDelete" style="margin-top:8px;color:var(--red)">Delete branch</button>`);
  setTimeout(() => {
    wireSheetBack();
    let vis = b.visibility || 'private';
    const wrap = document.getElementById('brVisEdit');
    if (wrap) wrap.querySelectorAll('[data-vis]').forEach((btn) => {
      btn.onclick = async () => {
        vis = btn.dataset.vis;
        wrap.querySelectorAll('[data-vis]').forEach((x) => x.classList.toggle('solid', x.dataset.vis === vis));
        const { status, data } = await api('/branches/' + encodeURIComponent(b.id), { method: 'PATCH', body: { visibility: vis } });
        if (status === 200) { applyBranches(data); toast('Visibility → ' + vis); renderPins(); refreshDirectory(); }
        else toast((data && data.error) || 'Update failed');
      };
    });
    const del = document.getElementById('brDelete');
    if (del) del.onclick = () => deleteBranch(b.id);
    const edit = document.getElementById('brEdit');
    if (edit) edit.onclick = () => {
      closeSheet();
      sheetMode = null;
      openBranchWizard({ id: b.id, lat: b.lat, lng: b.lng, address: b.address || '' });
    };
    const copilot = document.getElementById('brCopilot');
    if (copilot) copilot.onclick = () => {
      closeSheet();
      sheetMode = null;
      ui.mode = 'browse';
      ui.drawerId = null;
      const q = `You are the StatVibe branch copilot. Analyze branch "${b.name}" at ${b.address || 'unknown address'}. Current stock ${b.stockLevel}, low-stock threshold ${b.stockThreshold}, status ${b.supplyStatus}, daily revenue ${b.dailyRevenue}, staff ${b.staffCount}. Detect anomalies and suggest restock actions with urgency.`;
      state.aiPrefill = q;
      state.tab = 'ai';
      state.stack = [];
      render();
      toast('Copilot prompt ready in AI Workspace');
    };
  }, 30);
}

export async function deleteBranch(id) {
  const b = branches().find((x) => x.id === id);
  if (!b) { toast('Branch not found'); return; }
  if (!confirm('Delete branch "' + b.name + '"?')) return;
  const { status, data } = await api('/branches/' + encodeURIComponent(id), { method: 'DELETE' });
  if (status === 200) {
    applyBranches(data);
    closeSheet();
    sheetMode = null;
    const ui = ensureMapUi();
    ui.mode = 'browse';
    ui.drawerId = null;
    refreshDirectory();
    renderPins();
    toast('Branch deleted');
  } else toast((data && data.error) || 'Could not delete');
}

export function editBranch(id) {
  const b = branches().find((x) => x.id === id);
  if (!b) { toast('Branch not found'); return; }
  openBranchWizard({ id: b.id, lat: b.lat, lng: b.lng, address: b.address || '' });
}

export function mapLogicalBack() {
  const sheet = document.getElementById('sheet');
  const sheetOpen = sheet && sheet.classList.contains('show');
  const ui = ensureMapUi();

  if (sheetOpen && (sheetMode === 'wizard' || sheetMode === 'drawer' || ui.mode === 'wizard' || ui.mode === 'drawer')) {
    closeSheet();
    sheetMode = null;
    if (ui.mode === 'wizard' || ui.pending) cancelPinning();
    else {
      ui.mode = 'browse';
      ui.drawerId = null;
    }
    return true;
  }

  if (ui.mode === 'verify' || ui.pending) {
    cancelPinning();
    return true;
  }

  if (ui.fullscreen) {
    toggleMapFullscreen();
    return true;
  }

  return false;
}

export function logicalBack() {
  if (mapLogicalBack()) return;
  if (state.stack.length) {
    state.stack.pop();
    render();
    return;
  }
  if (state.tab && state.tab !== 'stats') {
    const prev = state.tab;
    state.tab = 'stats';
    state.stack = [];
    render();
    if (prev === 'map') teardownBranchMap();
  }
}

export function onMapSheetDismissed() {
  if (sheetMode === 'wizard') cancelPinning();
  else {
    const ui = ensureMapUi();
    ui.mode = 'browse';
    ui.drawerId = null;
  }
  sheetMode = null;
}

export function teardownBranchMap() {
  destroyMap();
  sheetMode = null;
}
