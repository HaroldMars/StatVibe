import { state } from '../state.js';
import { appbar } from '../chrome.js';
import { esc, imgSrc } from '../utils.js';

export const screens = {};

screens.welcome = () => `
  <div class="scroll" style="padding:70px 22px 14px;display:flex;flex-direction:column">
    <div class="flex items-center" style="gap:9px;margin-bottom:auto">
      <img src="${imgSrc('/logo-main.png', { w: 96, h: 96 })}" alt="StatVibe" style="width:34px;height:34px;border-radius:9px" />
      <span style="font-size:17px;font-weight:700;letter-spacing:-.2px">StatVibe</span>
    </div>
    <div style="margin:28px 0 26px">
      <div style="font-size:30px;font-weight:700;line-height:1.15;letter-spacing:-.6px">Run the whole business from one screen.</div>
      <div style="font-size:14px;color:var(--muted);line-height:1.5;margin-top:12px">Real-time analytics, smart planning, and client messaging built for teams of any size, in any industry.</div>
    </div>
    <div class="stack gap-14" style="margin-bottom:26px">
      ${[['📊', 'Predictive dashboards', "See what's coming, not just what happened"],
         ['✨', 'Multi-model AI workspace', 'Blend the best models for every task'],
         ['💬', 'AgentTech assistant', 'AI handles client & partner messaging']]
        .map(([e, t, s]) => `<div class="flex items-center gap-12"><div style="width:38px;height:38px;border-radius:11px;background:var(--teal-tint);display:flex;align-items:center;justify-content:center;font-size:18px">${e}</div><div><div style="font-size:13.5px;font-weight:600">${t}</div><div style="font-size:11.5px;color:var(--muted-2)">${s}</div></div></div>`).join('')}
    </div>
    <div class="stack gap-10">
      <button class="btn" data-act="toRegister">Start free</button>
      <button class="btn outline" data-act="guest">Try as guest — no sign up</button>
      <button type="button" data-act="toLogin" style="background:none;border:none;box-shadow:none;padding:8px;color:var(--teal);font:600 13px var(--sans);cursor:pointer;-webkit-tap-highlight-color:transparent">I already have an account</button>
    </div>
    <div style="text-align:center;margin-top:14px"><span data-act="download" style="font-size:12.5px;color:var(--teal);font-weight:600;cursor:pointer">📲 Download / install the app</span></div>
    <div style="text-align:center;font-size:10.5px;color:var(--muted-3);line-height:1.6;margin-top:20px">A new, upcoming project of<br><a href="https://illuminary-peak.vercel.app/" target="_blank" rel="noopener noreferrer" style="color:var(--muted);font-weight:600;text-decoration:none">Illuminary Peak Company</a> · 2026</div>
  </div>`;

screens.register = () => `
  ${appbar('Create account')}
  <div class="scroll" style="padding:14px 22px 24px">
    <div style="font-size:24px;font-weight:700;letter-spacing:-.4px;margin-bottom:6px">Start your workspace</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:22px">Free during beta. Your account starts blank — you'll set up your business next.</div>
    <div class="field"><label>Full name</label><input id="regName" type="text" placeholder="Sam Rivera" autocomplete="name" /></div>
    <div class="field"><label>Work email</label><input id="regEmail" type="email" placeholder="you@business.com" autocomplete="email" /></div>
    <div class="field"><label>Password <span style="color:var(--muted-3);font-weight:400">· min 8 characters</span></label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="regPwd" type="password" placeholder="••••••••" autocomplete="new-password" style="flex:1" />
        <button class="pill" type="button" data-act="togglePwd" data-target="regPwd">Show</button>
      </div>
    </div>
    <label class="flex" style="gap:9px;align-items:flex-start;margin:4px 0 18px;cursor:pointer">
      <input id="regTerms" type="checkbox" style="margin-top:2px;width:16px;height:16px;accent-color:var(--teal)" />
      <span style="font-size:12px;color:var(--muted);line-height:1.5">I agree to the <b data-act="showTerms" data-tab-terms="terms" style="color:var(--teal);cursor:pointer">Terms of Service</b> and <b data-act="showTerms" data-tab-terms="privacy" style="color:var(--teal);cursor:pointer">Privacy Policy</b>.</span>
    </label>
    <button class="btn" data-act="doRegister">Create account</button>
    <div style="text-align:center;margin-top:16px;font-size:12.5px;color:var(--muted)">Have an account? <b data-act="toLogin" style="color:var(--teal);cursor:pointer">Sign in</b></div>
  </div>`;

screens.login = () => `
  ${appbar('Sign in')}
  <div class="scroll" style="padding:14px 22px 24px">
    <div style="font-size:24px;font-weight:700;letter-spacing:-.4px;margin-bottom:6px">Welcome back</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:22px">Sign in with an existing StatVibe account. Unregistered emails cannot sign in.</div>
    <div class="field"><label>Work email</label><input id="loginEmail" type="email" placeholder="you@business.com" autocomplete="email" required /></div>
    <div class="field"><label>Password</label>
      <div style="display:flex;gap:8px;align-items:center">
        <input id="loginPwd" type="password" placeholder="••••••••" autocomplete="current-password" style="flex:1" required />
        <button class="pill" type="button" data-act="togglePwd" data-target="loginPwd">Show</button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--muted);margin:-2px 0 14px;line-height:1.45">You'll stay signed in on this device for 30 days, or until you sign out.</div>
    <button class="btn" data-act="doLogin" style="margin-top:4px">Sign in</button>
    <div style="text-align:center;margin-top:16px;font-size:12.5px;color:var(--muted)">New here? <b data-act="toRegister" style="color:var(--teal);cursor:pointer">Create an account</b></div>
  </div>`;

screens.terms = (p = {}) => {
  const tab = p.tab || 'terms';
  const T = {
    terms: ['Terms of Service', `<p><b>StatVibe Beta.</b> This software is provided during a beta period, as-is, for evaluation. Features may change or be unavailable.</p><p>You agree to use StatVibe lawfully, to keep your login credentials secure, and not to misuse the AI or messaging features. You are responsible for the business data you enter.</p><p>Paid plans are billed via our payment provider; taxes may apply. You can cancel anytime; access continues until the end of the billing period.</p><p>We may suspend accounts that violate these terms. Liability is limited to the amount paid in the last 3 months.</p>`],
    privacy: ['Privacy Policy', `<p><b>Your data is yours.</b> We store your account, business setup, inventory and notes to provide the service. Passwords are stored only as salted hashes — never in plaintext.</p><p>We do not sell your data. AI prompts you submit are processed to generate results; when using local models, they stay on your own infrastructure.</p><p>Other users cannot see your account or data unless <b>you</b> share your StatVibe QR/tag with them. You can export or permanently delete your account and all its data at any time from Settings → Privacy & Security.</p><p>Payment details are handled by our PCI-compliant payment provider; we never store full card numbers.</p>`],
  };
  const [title, bodyHtml] = T[tab] || T.terms;
  return `
  ${appbar(title)}
  <div class="scroll" style="padding:14px 22px 30px;font-size:13px;line-height:1.6;color:var(--ink-2)">
    <div class="flex gap-8 mb-16">
      <button class="pill ${tab === 'terms' ? 'solid' : ''}" data-act="showTerms" data-tab-terms="terms">Terms</button>
      <button class="pill ${tab === 'privacy' ? 'solid' : ''}" data-act="showTerms" data-tab-terms="privacy">Privacy</button>
    </div>
    ${bodyHtml}
    <div style="font-size:11px;color:var(--muted-3);margin-top:20px">Illuminary Peak Company · 2026</div>
  </div>`;
};

screens.setup = () => {
  const curOpts = (state.session.currencies || []).map((c) => `<option value="${c.code}" ${c.code === (state.setupDraft.currency || 'USD') ? 'selected' : ''}>${c.code} · ${esc(c.name)} (${esc(c.symbol)})</option>`).join('');
  const industries = ['Retail', 'Food & Beverage', 'E-commerce', 'Services', 'Manufacturing', 'Wholesale', 'Hospitality', 'Other'];
  const goals = ['Track sales', 'Manage inventory', 'AI planning', 'Client messaging', 'Forecasting'];
  const d = state.setupDraft;
  const g = new Set(d.goals || []);
  return `
  <div class="scroll" style="padding:54px 22px 30px">
    <div class="flex items-center gap-10 mb-16">
      <img src="${imgSrc('/logo-main.png', { w: 80, h: 80 })}" alt="StatVibe" style="width:30px;height:30px;border-radius:8px" />
      <div><div style="font-size:12px;color:var(--muted-2)">Welcome${state.session.user && state.session.user.isGuest ? ', guest' : (state.session.user ? ', ' + esc(state.session.user.name.split(' ')[0]) : '')}</div><div style="font-size:11px;color:var(--teal);font-weight:600">Set up your business</div></div>
    </div>
    <div style="font-size:23px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px">Tell us about your business</div>
    <div style="font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:22px">This tunes your dashboard, calculator and AI. You can change any of it later in Settings.</div>

    <div class="field"><label>Business name</label><input id="suName" type="text" value="${esc(d.businessName || '')}" placeholder="e.g. Rivera Trading Co." /></div>
    <div class="field"><label>Industry</label><select id="suIndustry" style="width:100%;font:inherit;font-size:14px;padding:13px 14px;border:1px solid var(--line-2);border-radius:11px;background:var(--surface)">${industries.map((i) => `<option ${i === d.industry ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
    <div class="field"><label>Currency</label><select id="suCurrency" style="width:100%;font:inherit;font-size:14px;padding:13px 14px;border:1px solid var(--line-2);border-radius:11px;background:var(--surface)">${curOpts}</select></div>
    <div class="field"><label>Team size</label><select id="suTeam" style="width:100%;font:inherit;font-size:14px;padding:13px 14px;border:1px solid var(--line-2);border-radius:11px;background:var(--surface)">${['Just me', '2–10', '11–50', '51–200', '200+'].map((t) => `<option ${t === d.teamSize ? 'selected' : ''}>${t}</option>`).join('')}</select></div>

    <div class="field"><label>Do you sell or stock products?</label>
      <div class="flex gap-8">
        <button class="pill ${d.sellsProducts !== false ? 'solid' : ''}" data-act="suSells" data-v="yes">Yes — track inventory</button>
        <button class="pill ${d.sellsProducts === false ? 'solid' : ''}" data-act="suSells" data-v="no">Services only</button>
      </div>
    </div>

    <div class="field"><label>What do you want StatVibe to do? <span style="color:var(--muted-3);font-weight:400">· pick any</span></label>
      <div class="flex gap-8 flex-wrap">${goals.map((x) => `<button class="pill ${g.has(x) ? 'solid' : ''}" data-act="suGoal" data-v="${esc(x)}">${x}</button>`).join('')}</div>
    </div>

    <button class="btn" data-act="finishSetup" style="margin-top:8px">Finish setup →</button>
    <div style="text-align:center;margin-top:12px"><b data-act="logout" style="font-size:12px;color:var(--muted-2);cursor:pointer">Sign out</b></div>
  </div>`;
};
