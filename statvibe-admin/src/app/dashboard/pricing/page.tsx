'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatMoney } from '@/lib/utils';

type Quote = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  saleApplied?: boolean;
  display: { base: number; sale: number; subtotal: number; vat: number; total: number };
};

type Tier = {
  id: string;
  label: string;
  basePriceCents: number;
  salePriceCents: number;
  saleActive: boolean;
  discountPercent?: number;
};

type Config = {
  betaSaleEnabled: boolean;
  vatRate: number;
  tiers: Record<string, Tier>;
};

function centsToDollars(c: number) {
  return (Number(c) || 0) / 100;
}

export default function PricingPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [preview, setPreview] = useState<Record<string, Quote>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/billing/config')
      .then((r) => r.json())
      .then((d) => {
        setConfig(d.config);
        setPreview(d.preview || {});
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const livePreview = useMemo(() => {
    if (!config) return {};
    const vat = config.vatRate || 0.12;
    const out: Record<string, Quote> = {};
    for (const [id, tier] of Object.entries(config.tiers || {})) {
      if (id === 'Free' || id === 'Enterprise') continue;
      const saleOn = !!(config.betaSaleEnabled && tier.saleActive);
      const subtotal = saleOn && tier.salePriceCents < tier.basePriceCents ? tier.salePriceCents : tier.basePriceCents;
      const vatCents = Math.round(subtotal * vat);
      out[id] = {
        subtotalCents: subtotal,
        vatCents,
        totalCents: subtotal + vatCents,
        saleApplied: saleOn && subtotal === tier.salePriceCents,
        display: {
          base: centsToDollars(tier.basePriceCents),
          sale: centsToDollars(tier.salePriceCents),
          subtotal: centsToDollars(subtotal),
          vat: centsToDollars(vatCents),
          total: centsToDollars(subtotal + vatCents),
        },
      };
    }
    return out;
  }, [config]);

  async function save() {
    if (!config) return;
    setSaving(true);
    setMsg('');
    const r = await fetch('/api/billing/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const d = await r.json();
    setSaving(false);
    if (r.ok) {
      setConfig(d.config);
      setPreview(d.preview || {});
      setMsg('Saved — public checkout picks this up immediately via the API store.');
    } else {
      setMsg(d.error || 'Save failed');
    }
  }

  if (!config) {
    return <div className="text-sm text-slate-500">Loading pricing…</div>;
  }

  function patchTier(id: string, patch: Partial<Tier>) {
    setConfig({
      ...config,
      tiers: {
        ...config.tiers,
        [id]: { ...config.tiers[id], ...patch },
      },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscription pricing</h1>
          <p className="text-sm text-slate-500">Beta sale tiers · 12% VAT excluded from base · live checkout preview</p>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
      </div>
      {msg ? <p className="text-sm text-slate-600">{msg}</p> : null}

      <Card className="border-[#dde3f5]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Beta sale</CardTitle>
            <CardDescription>First-time subscriber discounts for Pro and Business</CardDescription>
          </div>
          <Button
            variant={config.betaSaleEnabled ? 'default' : 'outline'}
            onClick={() => setConfig({ ...config, betaSaleEnabled: !config.betaSaleEnabled })}
          >
            {config.betaSaleEnabled ? 'Enabled' : 'Disabled'}
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {['Pro', 'Business'].map((id) => {
          const tier = config.tiers[id];
          const q = livePreview[id] || preview[id];
          if (!tier) return null;
          return (
            <Card key={id} className="border-[#dde3f5]">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CardTitle>{tier.label || id}</CardTitle>
                  {q?.saleApplied ? <Badge variant="warning">Sale</Badge> : null}
                </div>
                <CardDescription>Original list price vs temporary sale price (USD)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Base price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={centsToDollars(tier.basePriceCents)}
                      onChange={(e) => patchTier(id, { basePriceCents: Math.round(Number(e.target.value) * 100) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sale price ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={centsToDollars(tier.salePriceCents)}
                      onChange={(e) => patchTier(id, { salePriceCents: Math.round(Number(e.target.value) * 100) })}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={tier.saleActive ? 'default' : 'outline'}
                  onClick={() => patchTier(id, { saleActive: !tier.saleActive })}
                >
                  Tier sale {tier.saleActive ? 'on' : 'off'}
                </Button>
                {q ? (
                  <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <div>Subtotal {formatMoney(q.display.subtotal)}</div>
                    <div>+ 12% VAT {formatMoney(q.display.vat)}</div>
                    <div className="mt-1 font-semibold tabular-nums">Total charged {formatMoney(q.display.total)}</div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
