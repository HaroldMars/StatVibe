import { randomUUID } from 'node:crypto';
import { hashPassword } from './auth';
import { ROLES, type AdminRole, type PlanId, type TxStatus, type UserStatus } from './rbac';

export type AdminAccount = {
  id: string;
  username: string;
  displayName: string;
  role: AdminRole;
  passwordHash: string;
  createdAt: string;
  createdBy?: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  plan: PlanId;
  createdAt: string;
  lastActiveAt: string | null;
};

export type Transaction = {
  id: string;
  userId: string;
  userName: string;
  plan: PlanId;
  amount: number;
  currency: string;
  status: TxStatus;
  createdAt: string;
};

type StoreShape = {
  admins: AdminAccount[];
  users: AppUser[];
  transactions: Transaction[];
  subscriptionsConfig: {
    betaSaleEnabled: boolean;
    vatRate: number;
    currency: string;
    tiers: Record<string, {
      id: string;
      label: string;
      basePriceCents: number;
      salePriceCents: number;
      saleActive: boolean;
      discountPercent: number;
    }>;
  };
  systemNotifications: Array<{
    id: string;
    title: string;
    body: string;
    category: string;
    target: string;
    channels: string[];
    startsAt: number;
    endsAt: number | null;
    dismissible: boolean;
    ctaLabel: string | null;
    ctaUrl: string | null;
    active: boolean;
    createdAt: number;
  }>;
  seeded: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __statvibeAdminStore: StoreShape | undefined;
}

function blank(): StoreShape {
  return {
    admins: [],
    users: [],
    transactions: [],
    subscriptionsConfig: {
      betaSaleEnabled: true,
      vatRate: 0.12,
      currency: 'USD',
      tiers: {
        Free: { id: 'Free', label: 'Free', basePriceCents: 0, salePriceCents: 0, saleActive: false, discountPercent: 0 },
        Pro: { id: 'Pro', label: 'Pro', basePriceCents: 2000, salePriceCents: 1000, saleActive: true, discountPercent: 50 },
        Business: { id: 'Business', label: 'Business', basePriceCents: 7900, salePriceCents: 4900, saleActive: true, discountPercent: 38 },
        Enterprise: { id: 'Enterprise', label: 'Enterprise', basePriceCents: 0, salePriceCents: 0, saleActive: false, discountPercent: 0 },
      },
    },
    systemNotifications: [],
    seeded: false,
  };
}

export function getStore(): StoreShape {
  if (!globalThis.__statvibeAdminStore) {
    globalThis.__statvibeAdminStore = blank();
  }
  return globalThis.__statvibeAdminStore;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n: number) {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

export async function ensureSeeded() {
  const store = getStore();
  if (store.seeded) return store;

  const ceoUser = process.env.ADMIN_CEO_USERNAME || 'GenAdmin';
  const ceoPass = process.env.ADMIN_CEO_PASSWORD || 'genadmin-2026';
  const ceoName = process.env.ADMIN_CEO_NAME || 'Jay Harold Mars Abejar';

  store.admins = [
    {
      id: 'adm_ceo',
      username: ceoUser,
      displayName: ceoName,
      role: ROLES.CEO_FOUNDER,
      passwordHash: await hashPassword(ceoPass),
      createdAt: daysAgo(120),
    },
  ];

  const names = [
    'John Smith', 'Maria Garcia', 'Alex Chen', 'Priya Patel', 'Noah Kim',
    'Sofia Rossi', 'Liam OBrien', 'Ava Nguyen', 'Ethan Brooks', 'Mia Torres',
    'Lucas Meyer', 'Emma Dubois', 'Oliver Park', 'Isabella Cruz', 'Mason Wright',
  ];
  const statuses: UserStatus[] = ['APPROVED', 'APPROVED', 'APPROVED', 'PENDING', 'SUSPENDED', 'APPROVED', 'PENDING', 'APPROVED'];
  const plans: PlanId[] = ['Free', 'Pro', 'Business', 'Pro', 'Free', 'Business', 'Free', 'Enterprise'];

  store.users = names.map((name, i) => {
    const status = statuses[i % statuses.length];
    const plan = plans[i % plans.length];
    const created = daysAgo(90 - i * 3);
    return {
      id: `usr_${i + 1}`,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`,
      status,
      plan: status === 'PENDING' ? 'Free' : plan,
      createdAt: created,
      lastActiveAt: status === 'APPROVED' ? hoursAgo((i % 48) + 1) : null,
    };
  });

  const txs: Transaction[] = [];
  const amounts: Record<PlanId, number> = { Free: 0, Pro: 1120, Business: 5488, Enterprise: 0 };
  for (let i = 0; i < 64; i++) {
    const user = store.users[i % store.users.length];
    const plan = (['Pro', 'Business', 'Pro', 'Free', 'Business'] as PlanId[])[i % 5];
    const status: TxStatus = (['succeeded', 'succeeded', 'succeeded', 'pending', 'failed', 'refunded'] as TxStatus[])[i % 6];
    txs.push({
      id: `txn_${1000 + i}`,
      userId: user.id,
      userName: user.name,
      plan,
      amount: amounts[plan],
      currency: 'USD',
      status,
      createdAt: daysAgo(Math.floor(i * 1.4)),
    });
  }
  store.transactions = txs;
  store.seeded = true;
  return store;
}

export async function findAdminByUsername(username: string) {
  const store = await ensureSeeded();
  return store.admins.find((a) => a.username.toLowerCase() === username.toLowerCase()) || null;
}

export async function listEmployees() {
  const store = await ensureSeeded();
  return store.admins.map(({ passwordHash: _, ...rest }) => rest);
}

export async function createEmployee(input: {
  username: string;
  displayName: string;
  password: string;
  createdBy: string;
}) {
  const store = await ensureSeeded();
  const exists = store.admins.some((a) => a.username.toLowerCase() === input.username.toLowerCase());
  if (exists) throw new Error('Username already exists');
  if (input.username.length < 3) throw new Error('Username too short');
  if (input.password.length < 8) throw new Error('Password must be at least 8 characters');

  const admin: AdminAccount = {
    id: `adm_${randomUUID().slice(0, 8)}`,
    username: input.username.trim(),
    displayName: input.displayName.trim() || input.username.trim(),
    role: ROLES.EMPLOYEE,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy,
  };
  store.admins.push(admin);
  const { passwordHash: _, ...safe } = admin;
  return safe;
}

export async function listUsers(query?: string) {
  const store = await ensureSeeded();
  const q = (query || '').trim().toLowerCase();
  let users = store.users;
  if (q) {
    users = users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.includes(q)
    );
  }
  return users;
}

export async function setUserStatus(id: string, status: UserStatus) {
  const store = await ensureSeeded();
  const user = store.users.find((u) => u.id === id);
  if (!user) throw new Error('User not found');
  user.status = status;
  if (status === 'APPROVED' && !user.lastActiveAt) user.lastActiveAt = new Date().toISOString();
  return user;
}

export async function listTransactions() {
  const store = await ensureSeeded();
  return [...store.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOverview() {
  const store = await ensureSeeded();
  const totalUsers = store.users.length;
  const activeUsers = store.users.filter((u) => u.status === 'APPROVED' && u.lastActiveAt).length;
  const pendingApprovals = store.users.filter((u) => u.status === 'PENDING').length;
  const totalRevenue = store.transactions
    .filter((t) => t.status === 'succeeded')
    .reduce((sum, t) => sum + t.amount, 0);
  return { totalUsers, activeUsers, pendingApprovals, totalRevenue };
}

function quoteTier(tier: StoreShape['subscriptionsConfig']['tiers'][string], betaSaleEnabled: boolean, vatRate: number) {
  const saleOn = !!(betaSaleEnabled && tier.saleActive && tier.salePriceCents > 0 && tier.salePriceCents < tier.basePriceCents);
  const subtotalCents = saleOn ? tier.salePriceCents : tier.basePriceCents;
  const vatCents = Math.round(subtotalCents * vatRate);
  return {
    plan: tier.id,
    subtotalCents,
    vatCents,
    totalCents: subtotalCents + vatCents,
    saleApplied: saleOn,
    display: {
      base: tier.basePriceCents / 100,
      sale: tier.salePriceCents / 100,
      subtotal: subtotalCents / 100,
      vat: vatCents / 100,
      total: (subtotalCents + vatCents) / 100,
    },
  };
}

export async function getSubscriptionsConfig() {
  const store = await ensureSeeded();
  const config = store.subscriptionsConfig;
  const preview: Record<string, ReturnType<typeof quoteTier>> = {};
  for (const [id, tier] of Object.entries(config.tiers)) {
    preview[id] = quoteTier(tier, config.betaSaleEnabled, config.vatRate);
  }
  return { config, preview };
}

export async function setSubscriptionsConfig(patch: Partial<StoreShape['subscriptionsConfig']> & { tiers?: Record<string, Partial<StoreShape['subscriptionsConfig']['tiers'][string]>> }) {
  const store = await ensureSeeded();
  if (typeof patch.betaSaleEnabled === 'boolean') store.subscriptionsConfig.betaSaleEnabled = patch.betaSaleEnabled;
  if (patch.vatRate != null) store.subscriptionsConfig.vatRate = Number(patch.vatRate);
  if (patch.tiers) {
    for (const [id, t] of Object.entries(patch.tiers)) {
      store.subscriptionsConfig.tiers[id] = {
        ...store.subscriptionsConfig.tiers[id],
        ...t,
        id,
      };
    }
  }
  return getSubscriptionsConfig();
}

export async function listSystemNotifications() {
  const store = await ensureSeeded();
  return [...store.systemNotifications].sort((a, b) => b.createdAt - a.createdAt);
}

export async function createSystemNotification(input: {
  title: string;
  body: string;
  category: string;
  channels?: string[];
  dismissible?: boolean;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  active?: boolean;
}) {
  const store = await ensureSeeded();
  const note = {
    id: `ntf_${randomUUID().slice(0, 8)}`,
    title: input.title.trim(),
    body: input.body.trim(),
    category: input.category || 'system_update',
    target: 'all',
    channels: input.channels || ['in_app'],
    startsAt: Date.now(),
    endsAt: null as number | null,
    dismissible: input.dismissible !== false,
    ctaLabel: input.ctaLabel || null,
    ctaUrl: input.ctaUrl || null,
    active: input.active !== false,
    createdAt: Date.now(),
  };
  store.systemNotifications.unshift(note);
  return note;
}

export async function deleteSystemNotification(id: string) {
  const store = await ensureSeeded();
  store.systemNotifications = store.systemNotifications.filter((n) => n.id !== id);
  return { ok: true };
}
