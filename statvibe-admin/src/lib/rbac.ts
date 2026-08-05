export const ROLES = {
  CEO_FOUNDER: 'CEO_FOUNDER',
  EMPLOYEE: 'EMPLOYEE',
} as const;

export type AdminRole = (typeof ROLES)[keyof typeof ROLES];

export type UserStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';
export type PlanId = 'Free' | 'Pro' | 'Enterprise';
export type TxStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';

export function isCeo(role?: string | null): boolean {
  return role === ROLES.CEO_FOUNDER;
}

export function canManageEmployees(role?: string | null): boolean {
  return isCeo(role);
}
