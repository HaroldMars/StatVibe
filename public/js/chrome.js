import { state } from './state.js';
import { I } from './icons.js';

export function tabbar(active) {
  const item = (id, label, icon, badge) => `
    <button data-tab="${id}" class="${active === id ? 'active' : ''}" style="position:relative">
      ${badge ? `<span style="position:absolute;top:-2px;right:8px;min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--red);color:#fff;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center;box-sizing:border-box">${badge > 9 ? '9+' : badge}</span>` : ''}
      ${icon(active === id ? 'currentColor' : 'currentColor')}<span>${label}</span>
    </button>`;
  const unread = (state.session && state.session.unreadTotal) || 0;
  return `<div class="tabbar">
    ${item('stats', 'Stats', I.bars)}
    ${item('calc', 'Calc', I.calc)}
    ${item('hub', 'Hub', I.bulb)}
    ${item('ai', 'AI', (c) => I.spark(c))}
    ${item('agent', 'Agent', I.chat, active === 'agent' ? 0 : unread)}
  </div>`;
}

export function appbar(title, { onSurface = false, right = '' } = {}) {
  return `<div class="appbar ${onSurface ? 'on-surface' : ''}">
    <button class="iconbtn ${onSurface ? 'plain' : ''}" data-act="back">${I.back}</button>
    <span class="title">${title}</span>
    ${right || '<div style="width:34px"></div>'}
  </div>`;
}
