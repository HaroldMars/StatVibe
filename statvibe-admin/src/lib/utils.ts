import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Half-mask a display name for privacy: "John Smith" → "J**n S***h" */
export function maskName(fullName: string | null | undefined): string {
  if (!fullName || !String(fullName).trim()) return '—';
  return String(fullName)
    .trim()
    .split(/\s+/)
    .map((part) => {
      if (part.length <= 1) return part;
      if (part.length === 2) return `${part[0]}*`;
      const mid = '*'.repeat(Math.max(1, part.length - 2));
      return `${part[0]}${mid}${part[part.length - 1]}`;
    })
    .join(' ');
}

export function formatMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n || 0);
}
