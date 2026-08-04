/** Mirrors StatVibe in-app subscription plans (lib/usage.js + screens/plans). */
export type PlanId = 'Free' | 'Pro' | 'Business' | 'Enterprise';

export type Plan = {
  id: PlanId;
  name: string;
  monthly: number | null; // PHP; null = custom
  annual: number | null;  // PHP billed yearly (2 months free ≈ 10× monthly)
  blurb: string;
  features: string[];
  popular?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: 'Free',
    name: 'Free',
    monthly: 0,
    annual: 0,
    blurb: 'Start free — weekly AI tokens with core tools.',
    features: [
      '50,000 AI tokens every week',
      'Predictive dashboards & calculator',
      'Idea Hub & multi-branch basics',
      'Weekly token reset',
    ],
  },
  {
    id: 'Pro',
    name: 'Pro',
    monthly: 1699,
    annual: 16990,
    blurb: 'For growing teams that need monthly AI capacity.',
    features: [
      '1,000,000 AI tokens / month',
      '3 workspaces',
      'Project hub & forecasting',
      'Priority AI throughput',
    ],
  },
  {
    id: 'Business',
    name: 'Business',
    monthly: 4499,
    annual: 44990,
    popular: true,
    blurb: 'Full stack — AgentTech, Blend models, multi-branch ops.',
    features: [
      '5,000,000 AI tokens / month',
      'All models & Blend mode',
      'AgentTech messaging assistant',
      'Advanced forecasting & multi-branch hub',
    ],
  },
  {
    id: 'Enterprise',
    name: 'Enterprise',
    monthly: null,
    annual: null,
    blurb: 'Unlimited scale with SSO, audit logs, and SLAs.',
    features: [
      'Unlimited AI tokens',
      'SSO & audit logs',
      'Dedicated support & SLAs',
      'Custom branch & data controls',
    ],
  },
];

export function formatPhp(amount: number): string {
  return '₱' + amount.toLocaleString('en-PH');
}
