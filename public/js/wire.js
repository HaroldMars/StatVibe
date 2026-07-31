import { state } from './state.js';
import { $, esc, toast, hasStatInputs, saveStatsDraft, money, scheduleAccountPersist, initials } from './utils.js';
import { computeRetail, computeProduct } from './calc-math.js';
import { openSheet, closeSheet, setOnSheetBackdropDismiss } from './sheet.js';
import { go, push, back, render } from './router.js';
import { themePicker } from './theme.js';

import { runWorkspace, titleFor, toggleEngine, loadModels } from './features/ai.js';
import { editIdea, newIdea, aivibe, aiHistorySheet } from './features/ideas.js';
import {
  openChat, newChatSheet, agentDraft, agentSend, approveSend, editDraft, agentSettingsSheet,
} from './features/messaging.js';
import {
  adminLogin, adminLogout, adminRefresh, adminSetConfig, adminRunTest, adminJump,
  adminResetApp, openAdmin, adminFetch,
} from './features/admin.js';
import {
  doGuest, doRegister, doLogin, doLogout, captureSetup, finishSetup, changePasswordSheet, goAuthScreen,
} from './features/auth.js';
import {
  tutorialStart, tutorialNext, tutorialPrev, tutorialSkip, tutorialFinish,
} from './features/tutorial.js';
import { addItemSheet, predictItem, itemMenu, updateCalc } from './features/inventory.js';
import {
  downloadSheet, exportData, qrSheet, paymentSheet, deleteAccountConfirm,
  editBusinessSheet, currencySheet, doUpgrade,
} from './features/account.js';

export function wire(root) {
  // Bind the delegated click handler exactly once — #app persists across
  // renders, so re-adding it each time would stack duplicate listeners.
  if (!root._clickBound) {
    root._clickBound = true;
    bindClicks(root);
  }
  wireScreen(root);
}

export function bindClicks(root) {
  // Tapping the dimmed backdrop while the first-run tutorial is open = Skip.
  setOnSheetBackdropDismiss(() => {
    if (state.tutorial && state.tutorial.open) {
      tutorialSkip();
      return true;
    }
    return false;
  });

  root.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act],[data-tab],[data-seg] button');
    if (!t) return;

    // segmented controls
    const seg = t.closest('[data-seg]');
    if (seg && t.dataset.v) {
      const which = seg.dataset.seg;
      if (which === 'calc') { state.calc.tab = t.dataset.v; scheduleAccountPersist(); }
      if (which === 'period') state.period = t.dataset.v;
      render();
      return;
    }

    // any element carrying data-tab jumps to that tab (tab bar, shortcuts,
    // settings row) unless it also carries a data-act handled in the switch
    // below that needs the sub-screen behaviour (none currently do).
    if (t.dataset.tab) { go(t.dataset.tab); return; }

    const act = t.dataset.act;
    switch (act) {
      case 'back': back(); break;
      // auth
      case 'toRegister': goAuthScreen('register'); break;
      case 'toLogin': goAuthScreen('login'); break;
      case 'guest': doGuest(); break;
      case 'download': downloadSheet(); break;
      case 'doRegister': e.preventDefault(); doRegister(); break;
      case 'doLogin': e.preventDefault(); doLogin(); break;
      case 'showTerms': push('terms', { tab: t.dataset.tabTerms || 'terms' }); break;
      case 'togglePwd': {
        const id = t.dataset.target;
        const inp = id ? document.getElementById(id) : null;
        if (!inp) break;
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        t.textContent = show ? 'Hide' : 'Show';
        break;
      }
      case 'logout': doLogout(); break;
      case 'tutorialStart': tutorialStart(); break;
      case 'tutorialNext': tutorialNext(); break;
      case 'tutorialPrev': tutorialPrev(); break;
      case 'tutorialSkip': tutorialSkip(); break;
      case 'tutorialFinish': tutorialFinish(); break;
      // setup wizard
      case 'suSells': captureSetup(); state.setupDraft.sellsProducts = t.dataset.v === 'yes'; render(); break;
      case 'suGoal': { captureSetup(); const g = new Set(state.setupDraft.goals || []); g.has(t.dataset.v) ? g.delete(t.dataset.v) : g.add(t.dataset.v); state.setupDraft.goals = [...g]; render(); break; }
      case 'finishSetup': finishSetup(); break;
      // inventory
      case 'addItem': addItemSheet(); break;
      case 'predictItem': predictItem(t.dataset.id); break;
      case 'itemMenu': itemMenu(t.dataset.id); break;

      case 'goto': push(t.dataset.s); break;
      case 'gotoTab': go(t.dataset.tab); break;
      case 'openAlert': if (t.dataset.s === 'agent') { state.authed && (state.stack = []); go('agent'); } else if (t.dataset.s) go(t.dataset.s); break;
      case 'editIdea': editIdea(t.dataset.id); break;
      case 'newIdea': newIdea(); break;
      case 'aivibe': aivibe(); break;

      case 'switchWorkspace': openSheet(`<h3>Switch workspace</h3><div class="list" style="margin-top:12px">
        <button class="row" data-pick="Illuminary Peak"><span>Illuminary Peak</span><span class="tagchip green">Current</span></button>
        <button class="row" data-pick="Atlas Coffee Co."><span>Atlas Coffee Co.</span><span class="val">›</span></button>
        <button class="row" data-pick="New workspace…"><span style="color:var(--teal);font-weight:600">+ New workspace</span></button>
      </div>`); break;

      case 'applyPlan': toast('Forecast applied to your plan ✓'); break;
      case 'askAI': state.aiPrefill = t.dataset.q || ''; go('ai'); break;
      case 'saveStatsInputs': {
        state.statsDraft.revenue = ((document.getElementById('statsRevenue') || {}).value || '').trim();
        state.statsDraft.products = ((document.getElementById('statsProducts') || {}).value || '').trim();
        state.statsDraft.avgPrice = ((document.getElementById('statsAvgPrice') || {}).value || '').trim();
        if (!hasStatInputs()) { toast('Enter revenue, products, and avg price'); break; }
        saveStatsDraft();
        render();
        toast('Stats computed');
        break;
      }
      case 'editStatsInputs': {
        openSheet(`<h3>Edit statistics inputs</h3>
          <div class="field" style="margin-top:12px"><label>Revenue (MTD)</label><input id="statsRevenueEdit" inputmode="decimal" value="${esc(state.statsDraft.revenue || '')}" /></div>
          <div class="field"><label>Products sold (MTD)</label><input id="statsProductsEdit" inputmode="decimal" value="${esc(state.statsDraft.products || '')}" /></div>
          <div class="field"><label>Average price</label><input id="statsAvgPriceEdit" inputmode="decimal" value="${esc(state.statsDraft.avgPrice || '')}" /></div>
          <button class="btn" data-act="saveStatsInputsEdit">Save</button>`);
        break;
      }
      case 'saveStatsInputsEdit': {
        state.statsDraft.revenue = ((document.getElementById('statsRevenueEdit') || {}).value || '').trim();
        state.statsDraft.products = ((document.getElementById('statsProductsEdit') || {}).value || '').trim();
        state.statsDraft.avgPrice = ((document.getElementById('statsAvgPriceEdit') || {}).value || '').trim();
        if (!hasStatInputs()) { toast('Enter revenue, products, and avg price'); break; }
        saveStatsDraft();
        closeSheet();
        render();
        toast('Stats updated');
        break;
      }

      // calculator
      case 'calcReset': state.calc = { tab: state.calc.tab, unitCost: 42, freight: 5.72, overhead: 5.1, targetMargin: 55, markup: 55 }; scheduleAccountPersist(); render(); toast('Reset to defaults'); break;
      case 'calcAI': {
        const c = state.calc;
        const retail = computeRetail(c);
        const product = computeProduct(c);
        const active = c.tab === 'Product' ? product : retail;
        const prompt = c.tab === 'Product'
          ? `Our product costs ${money(active.cost)} total (materials ${money(c.unitCost)}, labor ${money(c.freight)}, overhead ${money(c.overhead)}). We target a ${active.targetMargin}% gross margin, which prices at ${money(active.price)} (profit ${money(active.profit)}/unit, implied markup ${active.markup.toFixed(1)}%). Recommend an optimal sell price and margin strategy vs competitors.`
          : `Our retail SKU has a landed cost of ${money(active.cost)} (unit ${money(c.unitCost)} + freight ${money(c.freight)} + overhead ${money(c.overhead)}). We apply a ${active.markup}% markup for a shelf price of ${money(active.price)} (${active.margin.toFixed(1)}% gross margin, profit ${money(active.profit)}/unit). Recommend an optimal retail price and markup.`;
        runWorkspace(prompt, c.tab === 'Product' ? 'Product price optimization' : 'Retail price optimization');
        break;
      }
      case 'reorder': toast('Reorder PO drafted — review in Agent'); break;

      // AI workspace
      case 'toggleEngine': toggleEngine(t.dataset.id); break;
      case 'cloudUnavail': toast(`${t.dataset.l} — Not available yet`); break;
      case 'toggleBlend': state.models.blend = !state.models.blend; state.settings.blend = state.models.blend; render(); break;
      case 'aiHistory': aiHistorySheet(); break;
      case 'runAI': { const p = ($('#aiPrompt') && $('#aiPrompt').value.trim()) || ''; if (!p) { toast('Type a prompt first'); break; } state.aiPrefill = ''; runWorkspace(p, titleFor(p)); break; }
      case 'runTask': runWorkspace(t.dataset.q, titleFor(t.dataset.q)); break;

      // AI output
      case 'refineAI': if (state.lastAIOutput) runWorkspace('Refine and tighten this document, keeping the same structure:\n\n' + state.lastAIOutput.content, state.lastAIOutput.title); break;
      case 'copyOutput': navigator.clipboard && navigator.clipboard.writeText(state.lastAIOutput ? state.lastAIOutput.content : '').then(() => toast('Copied to clipboard')); break;
      case 'exportOutput': case 'exportRevenue': toast('Exported'); break;
      case 'outputMenu': openSheet(`<h3>${esc(state.lastAIOutput ? state.lastAIOutput.title : 'Document')}</h3><div class="list" style="margin-top:12px"><button class="row" data-close><span>Duplicate</span></button><button class="row" data-close><span>Share link</span></button><button class="row" data-close><span style="color:var(--red)">Delete</span></button></div>`); break;

      // agent / messaging
      case 'openChat': openChat(t.dataset.id); break;
      case 'newChat': newChatSheet(); break;
      case 'agentDraft': agentDraft(); break;
      case 'agentSend': agentSend(); break;
      case 'approveSend': approveSend(); break;
      case 'editDraft': editDraft(); break;
      case 'agentSettings': agentSettingsSheet(); break;

      // plans
      case 'upgrade': case 'choosePlan': doUpgrade(t.dataset.p); break;

      // settings
      case 'toggleSettingBlend': state.settings.blend = !state.settings.blend; state.models.blend = state.settings.blend; render(); break;
      case 'toggleNotifications': state.settings.notifications = !state.settings.notifications; render(); toast(`Notifications ${state.settings.notifications ? 'on' : 'off'}`); break;
      case 'saveProfile': back(); toast('Profile saved ✓'); break;
      case 'changePwd': changePasswordSheet(); break;
      case 'twoFactor': toast('Two-factor setup coming soon'); break;
      case 'pickAppearance': themePicker(); break;
      case 'signout': doLogout(); break;
      // privacy & security / billing
      case 'changePwd2': changePasswordSheet(); break;
      case 'activeSessions': toast('1 active session · this device'); break;
      case 'exportData': exportData(); break;
      case 'myQR': qrSheet(); break;
      case 'copyTag': navigator.clipboard && navigator.clipboard.writeText(t.dataset.tag || '').then(() => toast('Code copied')); break;
      case 'paymentMethod': paymentSheet(); break;
      case 'deleteAccount': deleteAccountConfirm(); break;
      case 'editBusiness': editBusinessSheet(); break;
      case 'pickCurrency': currencySheet(); break;
      case 'noop': break;

      // admin / developer console
      case 'openAdmin': openAdmin(); break;
      case 'adminLogin': adminLogin(); break;
      case 'adminLogout': adminLogout(); break;
      case 'adminRefresh': adminRefresh(); break;
      case 'admSimulate': adminSetConfig({ simulateOnly: !((state.admin.summary || {}).config || {}).simulateOnly }); break;
      case 'admBlend': adminSetConfig({ defaultBlend: !((state.admin.summary || {}).config || {}).defaultBlend }); break;
      case 'admCloud': { const cur = (((state.admin.summary || {}).config || {}).cloudAvailable || {})[t.dataset.id]; adminSetConfig({ cloudAvailable: { [t.dataset.id]: !cur } }); break; }
      case 'admRunTest': adminRunTest(); break;
      case 'admJump': adminJump(t.dataset.s); break;
      case 'admResetConfig': adminFetch('reset', 'POST').then(() => { adminRefresh(); loadModels(); toast('Server config reset'); }); break;
      case 'admResetApp': adminResetApp(); break;
    }
  });

  // sheet picks + sheet actions (Save in Edit stats lives here, not in #app)
  const sheet = document.getElementById('sheet');
  sheet.onclick = (e) => {
    const toggle = e.target.closest('[data-act="togglePwd"]');
    if (toggle) {
      const inp = document.getElementById(toggle.dataset.target || '');
      if (inp) {
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        toggle.textContent = show ? 'Hide' : 'Show';
      }
      return;
    }
    const pick = e.target.closest('[data-pick]');
    if (pick) {
      const w = pick.dataset.pick;
      if (w && !/new workspace/i.test(w)) { state.workspace = w; render(); toast('Switched to ' + w); }
      else toast('New workspace coming soon');
      closeSheet();
      return;
    }
    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    const actEl = e.target.closest('[data-act]');
    if (actEl && actEl.dataset.act) runSheetAct(actEl);
  };
}

export async function runSheetAct(t) {
  const act = t.dataset.act;
  // Tutorial sheet lives outside #app — handle its buttons here.
  if (act === 'tutorialStart') { tutorialStart(); return; }
  if (act === 'tutorialNext') { tutorialNext(); return; }
  if (act === 'tutorialPrev') { tutorialPrev(); return; }
  if (act === 'tutorialSkip') { await tutorialSkip(); return; }
  if (act === 'tutorialFinish') { await tutorialFinish(); return; }
  if (act === 'saveStatsInputsEdit') {
    state.statsDraft.revenue = ((document.getElementById('statsRevenueEdit') || {}).value || '').trim();
    state.statsDraft.products = ((document.getElementById('statsProductsEdit') || {}).value || '').trim();
    state.statsDraft.avgPrice = ((document.getElementById('statsAvgPriceEdit') || {}).value || '').trim();
    if (!hasStatInputs()) { toast('Enter revenue, products, and avg price'); return; }
    saveStatsDraft();
    closeSheet();
    render();
    toast('Stats updated');
    return;
  }
  if (act === 'copyTag') {
    if (navigator.clipboard) await navigator.clipboard.writeText(t.dataset.tag || '');
    toast('Code copied');
  }
}

// Per-render bindings for elements that are recreated on each screen.
export function wireScreen(root) {
  // calculator live inputs
  root.querySelectorAll('.calc-input').forEach((inp) => {
    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value.replace(/[^0-9.]/g, ''));
      if (!isNaN(v)) { state.calc[inp.dataset.k] = v; updateCalc(); scheduleAccountPersist(); }
    });
    inp.addEventListener('focus', () => inp.select());
  });

  // profile live inputs (update in place, keep focus)
  root.querySelectorAll('.profile-input').forEach((inp) => {
    inp.addEventListener('input', () => {
      state.profile[inp.dataset.k] = inp.value;
      if (inp.dataset.k === 'name') {
        const init = initials(inp.value);
        const av = $('#pfAvatar'); if (av) av.textContent = init;
        const nm = $('#pfName'); if (nm) nm.textContent = inp.value;
      }
    });
  });

  // agent enter-to-send
  const ai = $('#agentInput');
  if (ai) ai.addEventListener('keydown', (e) => { if (e.key === 'Enter') agentSend(); });
  const ap = $('#aiPrompt');
  if (ap) ap.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { const p = ap.value.trim(); if (p) runWorkspace(p, titleFor(p)); } });

  // Auth forms — Enter submits like Google / Instagram / banking apps.
  const loginForm = root.querySelector('#loginForm');
  if (loginForm) loginForm.addEventListener('submit', (e) => { e.preventDefault(); doLogin(); });
  const registerForm = root.querySelector('#registerForm');
  if (registerForm) registerForm.addEventListener('submit', (e) => { e.preventDefault(); doRegister(); });
}
