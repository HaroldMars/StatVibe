/** StatVibe UI icons — SVG graphics only (no emoji). User-typed emoji in messages stays as-is. */
export const I = {
  back: `<svg width="12" height="20" viewBox="0 0 12 20" fill="none"><path d="M10 2L2 10l8 8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bars: (c = 'currentColor', w = 21) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M5 21V11M12 21V5M19 21v-7" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  calc: (c = 'currentColor', w = 21) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2.5" stroke="${c}" stroke-width="1.8"/><path d="M8 8h8M8 12.5h2M12 12.5h.01M8 16.5h2M12 16.5h4" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  bulb: (c = 'currentColor', w = 21) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.2 1 2V16h6v-.5c0-.8.3-1.3 1-2A6 6 0 0 0 12 3Z" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  spark: (c = 'currentColor', w = 21, fill = false) => fill
    ? `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="${c}"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2Z"/></svg>`
    : `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4L12 3Z" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  chat: (c = 'currentColor', w = 21) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H9l-4 3v-3H4V5Z" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  bell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M9.5 20a2.5 2.5 0 0 0 5 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  plus: (c = 'currentColor', w = 16) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  chevR: `<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevDown: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  send: `<svg width="15" height="15" viewBox="0 0 24 24" fill="#fff"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2Z"/></svg>`,
  arrow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h13M12 5l7 7-7 7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 15V3m0 12l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ellipsis: `<svg width="18" height="18" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>`,
  copy: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.7"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="1.7"/></svg>`,
  phone: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 5a16 16 0 0 0 15 15v-3.5l-4-1.5-2 2a12 12 0 0 1-5-5l2-2-1.5-4H4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,

  // Extra UI graphics (replaced former emoji placeholders)
  trend: (c = 'currentColor', w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M3 17l6-6 4 4 7-8" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 7h6v6" stroke="${c}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  box: (c = 'currentColor', w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 8.5 12 14l9-5.5M12 14v7" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  warn: (c = 'currentColor', w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M12 3.5 21 20H3L12 3.5Z" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 10v4.5M12 17.5h.01" stroke="${c}" stroke-width="1.9" stroke-linecap="round"/></svg>`,
  clock: (c = 'currentColor', w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.25" stroke="${c}" stroke-width="1.7"/><path d="M12 8v4.5l3 1.8" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  wave: (c = 'currentColor', w = 28) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M4 12c1.5-2.5 3-3.5 4.5-3.5S11 10 12 12s2 3.5 3.5 3.5S18.5 14.5 20 12" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 17c1.5-2.5 3-3.5 4.5-3.5S11 15 12 17s2 3.5 3.5 3.5S18.5 19.5 20 17" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/></svg>`,
  device: (c = 'currentColor', w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><rect x="7" y="2.5" width="10" height="19" rx="2.2" stroke="${c}" stroke-width="1.7"/><path d="M11 18.5h2" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  android: (c = 'currentColor', w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M8 9.5h8v7.2a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V9.5Z" stroke="${c}" stroke-width="1.6"/><path d="M9 7.2 7.2 4.8M15 7.2l1.8-2.4M8 12.5H5.8M18.2 12.5H16M9.2 18.7v2M14.8 18.7v2" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="12.2" r="0.8" fill="${c}"/><circle cx="14" cy="12.2" r="0.8" fill="${c}"/></svg>`,
  desktop: (c = 'currentColor', w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="12" rx="2" stroke="${c}" stroke-width="1.7"/><path d="M8 20h8M12 16v4" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  check: (c = 'currentColor', w = 18) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="${c}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  history: (c = 'currentColor', w = 14) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" stroke="${c}" stroke-width="1.7" stroke-linecap="round"/><path d="M4.5 5v4.2H8.7M12 8v4.2l2.8 1.7" stroke="${c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

/** Tinted square tile used for empty states / feature rows. */
export function iconTile(svgHtml, { size = 38, radius = 11, bg = 'var(--teal-tint)', color = 'var(--teal)' } = {}) {
  return `<div class="icon-tile" style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${bg};color:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0">${svgHtml}</div>`;
}

/** Resolve a named icon for alerts / tutorial (returns SVG string). */
export function namedIcon(name, c = 'currentColor', w = 18) {
  const map = {
    bars: () => I.bars(c, w),
    calc: () => I.calc(c, w),
    spark: () => I.spark(c, w),
    chat: () => I.chat(c, w),
    bulb: () => I.bulb(c, w),
    trend: () => I.trend(c, w),
    box: () => I.box(c, w),
    warn: () => I.warn(c, w),
    clock: () => I.clock(c, w),
    wave: () => I.wave(c, w),
    history: () => I.history(c, w),
    check: () => I.check(c, w),
    device: () => I.device(c, w),
    android: () => I.android(c, w),
    desktop: () => I.desktop(c, w),
  };
  return (map[name] || map.spark)();
}
