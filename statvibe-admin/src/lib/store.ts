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
  seeded: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __statvibeAdminStore: StoreShape | undefined;
}

function blank(): StoreShape {
  return { admins: [], users: [], transactions: [], seeded: false };
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
  const plans: PlanId[] = ['Free', 'Pro', 'Enterprise', 'Pro', 'Free', 'Pro', 'Free', 'Enterprise'];

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
  const amounts: Record<PlanId, number> = { Free: 0, Pro: 1699, Enterprise: 4499 };
  for (let i = 0; i < 64; i++) {
    const user = store.users[i % store.users.length];
    const plan = (['Pro', 'Enterprise', 'Pro', 'Free', 'Pro'] as PlanId[])[i % 5];
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
