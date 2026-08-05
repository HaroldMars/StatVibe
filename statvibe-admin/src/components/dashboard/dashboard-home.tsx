'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatMoney } from '@/lib/utils';
import type { RangeKey } from '@/lib/analytics';

type Overview = {
  totalUsers: number;
  activeUsers: number;
  pendingApprovals: number;
  totalRevenue: number;
};

const ranges: { id: RangeKey; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
];

export function DashboardHome() {
  const [range, setRange] = useState<RangeKey>('month');
  const [chartMode, setChartMode] = useState<'area' | 'line'>('area');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [revenue, setRevenue] = useState<{ label: string; revenue: number }[]>([]);
  const [volume, setVolume] = useState<{ label: string; count: number }[]>([]);
  const [segments, setSegments] = useState<{ name: string; value: number; fill: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [o, r, v, s] = await Promise.all([
        fetch('/api/dashboard/overview').then((x) => x.json()),
        fetch(`/api/dashboard/revenue?range=${range}`).then((x) => x.json()),
        fetch(`/api/dashboard/volume?range=${range}`).then((x) => x.json()),
        fetch('/api/dashboard/segments').then((x) => x.json()),
      ]);
      if (cancelled) return;
      setOverview(o);
      setRevenue(r.series || []);
      setVolume(v.series || []);
      setSegments(s.segments || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const cards = useMemo(
    () => [
      { label: 'Total Users', value: overview?.totalUsers ?? '—' },
      { label: 'Total Revenue', value: overview ? formatMoney(overview.totalRevenue / 100) : '—' },
      { label: 'Active Users', value: overview?.activeUsers ?? '—' },
      { label: 'Pending Approvals', value: overview?.pendingApprovals ?? '—' },
    ],
    [overview]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">Live ops snapshot across users, revenue, and approvals.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-[#dde3f5]">
            <CardHeader className="pb-2">
              <CardDescription>{c.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">{c.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ranges.map((r) => (
          <Button key={r.id} size="sm" variant={range === r.id ? 'default' : 'outline'} className={range === r.id ? 'bg-[#5865f2] hover:bg-[#4654e0]' : ''} onClick={() => setRange(r.id)}>
            {r.label}
          </Button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant={chartMode === 'area' ? 'secondary' : 'outline'} onClick={() => setChartMode('area')}>Area</Button>
          <Button size="sm" variant={chartMode === 'line' ? 'secondary' : 'outline'} onClick={() => setChartMode('line')}>Line</Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-[#dde3f5] xl:col-span-2">
          <CardHeader>
            <CardTitle>Revenue analytics</CardTitle>
            <CardDescription>Succeeded subscription payments · {range}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5865f2" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#5865f2" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f5" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type={chartMode === 'line' ? 'linear' : 'monotone'} dataKey="revenue" stroke="#5865f2" fill={chartMode === 'area' ? 'url(#rev)' : 'transparent'} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-[#dde3f5]">
          <CardHeader>
            <CardTitle>User segments</CardTitle>
            <CardDescription>Active · new · pending</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segments} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={3}>
                  {segments.map((s) => (
                    <Cell key={s.name} fill={s.fill} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-2 space-y-1 text-xs text-slate-600">
              {segments.map((s) => (
                <li key={s.name} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.fill }} />{s.name}</span>
                  <span className="font-semibold tabular-nums">{s.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[#dde3f5]">
        <CardHeader>
          <CardTitle>Sales transaction volume</CardTitle>
          <CardDescription>Transaction frequency across the selected range</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volume}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e9f5" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#4F46E5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
