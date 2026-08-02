import { state } from './state.js';
import { STORAGE } from './api.js';
import { toast } from './utils.js';
import { openSheet, closeSheet } from './sheet.js';
import { render } from './router.js';
import { I } from './icons.js';

export const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
export function effectiveTheme() {
  const a = state.settings.appearance;
  if (a === 'Dark') return 'dark';
  if (a === 'Light') return 'light';
  return prefersDark() ? 'dark' : 'light'; // System / Default
}
export function applyTheme() {
  document.documentElement.setAttribute('data-theme', effectiveTheme());
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', effectiveTheme() === 'dark' ? '#0f1214' : '#0e7c66');
}
export function setAppearance(a) {
  state.settings.appearance = a;
  try { localStorage.setItem(STORAGE.THEME, a); } catch { /* ignore */ }
  applyTheme();
  closeSheet();
  render();
  toast('Appearance: ' + a);
}
export function themePicker() {
  const cur = state.settings.appearance;
  const opt = (val, label, desc) => `<button class="row" data-theme-pick="${val}"><div><div style="font-size:14px">${label}</div><div style="font-size:11.5px;color:var(--muted-2)">${desc}</div></div><span class="val" style="color:var(--teal)">${cur === val ? I.check('var(--teal)', 16) : ''}</span></button>`;
  openSheet(`<h3>Appearance</h3><div class="list" style="margin-top:12px">
    ${opt('Light', 'Light', 'Always light')}
    ${opt('Dark', 'Dark', 'Always dark')}
    ${opt('System', 'System (Default)', 'Match your device')}
  </div>`);
  setTimeout(() => { document.getElementById('sheet').querySelectorAll('[data-theme-pick]').forEach((b) => b.onclick = () => setAppearance(b.dataset.themePick)); }, 30);
}
