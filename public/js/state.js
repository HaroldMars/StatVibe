export const state = {
  authed: false,
  session: { token: null, user: null, account: null, inventory: [], ideas: [], history: [], conversations: [], unreadTotal: 0, agentAutoReply: false, currencies: [], cloudinary: null, loaded: false, restoring: false },
  tab: 'stats',
  stack: [],            // sub-screen history: [{screen, params}]
  period: 'Month',
  revenuePeriod: 'live', // live | day | week | month for cumulative chart
  calc: { tab: 'Retail', unitCost: 42.0, freight: 5.72, overhead: 5.1, targetMargin: 55, markup: 55 },
  supply: { onHand: 1240, reorder: 400, cover: 22 },
  setupDraft: { sellsProducts: true, goals: [] },
  predictions: {},   // itemId -> prediction result cache
  models: { engines: [], cloud: [], workspace: [], ollamaOnline: false, active: new Set(), blend: true, loaded: false },
  plan: 'Free',
  billingCatalog: null,
  systemNotifications: [],
  usage: { used: 0, limit: 50000, resetDays: 7, period: 'week', resetAt: null },
  statsDraft: { revenue: '', products: '', avgPrice: '' },
  aiPrefill: '',
  mapUi: { fullscreen: false, mode: 'browse', pending: null, drawerId: null },
  lastAIOutput: null,
  alerts: null,          // set on first render
  settings: { blend: true, appearance: 'System', notifications: true },
  auth: { remember: true, busy: false, formError: '', formCode: '', emailDraft: '' },
  tutorial: { open: false, step: -1 },
  profile: { name: 'Jordan Doyle', email: 'jordan@illuminarypeak.co', role: 'Owner', phone: '+1 (555) 018-2245', tz: 'Pacific Time · PT' },
  workspace: 'Illuminary Peak',
  admin: { authed: false, token: null, summary: null, busy: false, testOut: null, user: 'GenAdmin' },
  // Real messaging: conversations live in state.session; the open thread here.
  chat: { convId: null, other: null, messages: [], draft: null, drafting: false },
};
