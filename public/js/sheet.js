export const sheetDrag = { enabled: false, startY: 0, deltaY: 0 };

export function openSheet(html) {
  const s = document.getElementById('sheet');
  const b = document.getElementById('sheetBackdrop');
  s.innerHTML = '<div class="grab"></div>' + html;
  sheetDrag.enabled = true;
  sheetDrag.startY = 0;
  sheetDrag.deltaY = 0;
  s.style.transition = '';
  s.style.transform = '';
  b.classList.add('show');
  requestAnimationFrame(() => s.classList.add('show'));
}
export function closeSheet() {
  sheetDrag.enabled = false;
  document.getElementById('sheet').classList.remove('show');
  document.getElementById('sheetBackdrop').classList.remove('show');
}

function wireSheetTouch() {
  const backdrop = document.getElementById('sheetBackdrop');
  if (backdrop && !backdrop._svBound) {
    backdrop._svBound = true;
    backdrop.addEventListener('click', closeSheet);
  }

  // Mobile UX: allow swipe-down to dismiss bottom sheet.
  const sheetEl = document.getElementById('sheet');
  if (!sheetEl || sheetEl._svTouchBound) return;
  sheetEl._svTouchBound = true;
  sheetEl.addEventListener('touchstart', (e) => {
    if (!sheetDrag.enabled) return;
    if (!sheetEl.classList.contains('show')) return;
    // Start drag only near the top/handle area so form scrolling still works.
    const t = e.touches && e.touches[0];
    if (!t) return;
    if (t.clientY > window.innerHeight - sheetEl.offsetHeight + 90) return;
    sheetDrag.startY = t.clientY;
    sheetDrag.deltaY = 0;
    sheetEl.style.transition = 'none';
  }, { passive: true });
  sheetEl.addEventListener('touchmove', (e) => {
    if (!sheetDrag.enabled || !sheetDrag.startY) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    const dy = t.clientY - sheetDrag.startY;
    if (dy <= 0) return;
    sheetDrag.deltaY = dy;
    sheetEl.style.transform = `translateY(${Math.min(dy, 220)}px)`;
  }, { passive: true });
  sheetEl.addEventListener('touchend', () => {
    if (!sheetDrag.enabled || !sheetDrag.startY) return;
    const shouldClose = sheetDrag.deltaY > 80;
    sheetEl.style.transition = 'transform 0.22s ease';
    if (shouldClose) {
      sheetEl.style.transform = 'translateY(100%)';
      setTimeout(() => {
        sheetEl.style.transform = '';
        sheetEl.style.transition = '';
        closeSheet();
      }, 170);
    } else {
      sheetEl.style.transform = '';
      setTimeout(() => { sheetEl.style.transition = ''; }, 220);
    }
    sheetDrag.startY = 0;
    sheetDrag.deltaY = 0;
  }, { passive: true });
}

// Bind when the module loads (DOM is ready — module script is deferred).
wireSheetTouch();
