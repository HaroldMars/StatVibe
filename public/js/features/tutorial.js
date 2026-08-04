import { state } from '../state.js';
import { api } from '../api.js';
import { esc, toast } from '../utils.js';
import { openSheet, closeSheet } from '../sheet.js';
import { render } from '../router.js';
import { namedIcon } from '../icons.js';

const TUTORIAL_STEPS = [
  {
    title: 'Stats dashboard',
    body: 'Track revenue, products sold, and average price. Ask AI for insights based on your live numbers.',
    icon: 'bars',
  },
  {
    title: 'Business calculator',
    body: 'Retail uses markup pricing. Product uses target gross margin. Supply tracks inventory and restock timing.',
    icon: 'calc',
  },
  {
    title: 'Idea Hub & AI',
    body: 'Capture ideas, then use the AI workspace to draft plans, forecasts, and documents.',
    icon: 'spark',
  },
  {
    title: 'AgentTech messaging',
    body: 'Message clients with your StatVibe code. AI can draft a reply — you approve before sending.',
    icon: 'chat',
  },
];

export function needsTutorial() {
  const u = state.session.user;
  const a = state.session.account;
  if (!state.authed || !u || u.isGuest) return false;
  if (!(a && a.setupComplete)) return false;
  return !a.tutorialDone;
}

export function maybeShowTutorial() {
  if (!needsTutorial()) return false;
  // Guard against double-open (boot + finishSetup race).
  if (state.tutorial && state.tutorial.open) return true;
  state.tutorial = { open: true, step: -1 }; // -1 = intro modal
  showTutorialSheet();
  return true;
}

function showTutorialSheet() {
  const step = state.tutorial.step;
  if (step < 0) {
    openSheet(`<div class="tutorial-sheet">
      <div class="tutorial-icon">${namedIcon('wave', 'var(--teal)', 36)}</div>
      <h3>Welcome to StatVibe</h3>
      <p class="tutorial-copy">Take a quick tour of Stats, Calculator, Idea Hub, AI, and AgentTech — or skip and explore on your own.</p>
      <button type="button" class="btn" data-act="tutorialStart">Start tutorial</button>
      <button type="button" class="btn ghost" data-act="tutorialSkip" style="margin-top:8px">Skip</button>
    </div>`);
    return;
  }
  const s = TUTORIAL_STEPS[step];
  const last = step >= TUTORIAL_STEPS.length - 1;
  openSheet(`<div class="tutorial-sheet">
    <div class="tutorial-progress">${TUTORIAL_STEPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="tutorial-icon">${namedIcon(s.icon, 'var(--teal)', 36)}</div>
    <h3>${esc(s.title)}</h3>
    <p class="tutorial-copy">${esc(s.body)}</p>
    <div class="tutorial-nav">
      ${step > 0 ? `<button type="button" class="btn outline" data-act="tutorialPrev" style="flex:1">Back</button>` : ''}
      <button type="button" class="btn" data-act="${last ? 'tutorialFinish' : 'tutorialNext'}" style="flex:1">${last ? 'Finish' : 'Next'}</button>
    </div>
    <button type="button" class="btn ghost" data-act="tutorialSkip" style="margin-top:8px">Skip tutorial</button>
  </div>`);
}

export function tutorialStart() {
  state.tutorial.step = 0;
  showTutorialSheet();
}

export function tutorialNext() {
  state.tutorial.step = Math.min(TUTORIAL_STEPS.length - 1, (state.tutorial.step || 0) + 1);
  showTutorialSheet();
}

export function tutorialPrev() {
  state.tutorial.step = Math.max(0, (state.tutorial.step || 0) - 1);
  showTutorialSheet();
}

async function persistTutorial(action) {
  const { status, data } = await api('/account/tutorial', { method: 'POST', body: { action } });
  if (status === 200 && data.account) {
    state.session.account = data.account;
  } else if (state.session.account) {
    // Optimistic local mark so it never loops if offline.
    state.session.account.tutorialDone = true;
    state.session.account.tutorialCompletedAt = Date.now();
  }
  state.tutorial = { open: false, step: -1 };
  closeSheet();
  render();
  toast(action === 'skip' ? 'Tutorial skipped' : "You're ready to go");
}

export function tutorialSkip() { return persistTutorial('skip'); }
export function tutorialFinish() { return persistTutorial('complete'); }
