'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMoney } from '@/lib/utils';

type Tx = {
  id: string;
  userName: string;
  plan: string;
  amount: number;
  status: string;
  createdAt: string;
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [metrics, setMetrics] = useState<{ revenueCents: number; succeeded: number; count: number; byPlan: Record<string, number> } | null>(null);

  useEffect(() => {
    fetch('/api/transactions')
      .then((r) => r.json())
      .then((data) => {
        setTransactions(data.transactions || []);
        setMetrics(data.metrics || null);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
        <p className="text-sm text-slate-500">Plan subscription payments and revenue status.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-[#dde3f5]"><CardHeader><CardDescription>Gross revenue</CardDescription><CardTitle className="tabular-nums">{formatMoney((metrics?.revenueCents || 0) / 100)}</CardTitle></CardHeader></Card>
        <Card className="border-[#dde3f5]"><CardHeader><CardDescription>Succeeded</CardDescription><CardTitle className="tabular-nums">{metrics?.succeeded ?? '—'}</CardTitle></CardHeader></Card>
        <Card className="border-[#dde3f5]"><CardHeader><CardDescription>Pro payments</CardDescription><CardTitle className="tabular-nums">{metrics?.byPlan?.Pro ?? '—'}</CardTitle></CardHeader></Card>
        <Card className="border-[#dde3f5]"><CardHeader><CardDescription>Enterprise payments</CardDescription><CardTitle className="tabular-nums">{metrics?.byPlan?.Enterprise ?? '—'}</CardTitle></CardHeader></Card>
      </div>

      <Card className="border-[#dde3f5]">
        <CardHeader>
          <CardTitle>Payment feed</CardTitle>
          <CardDescription>Free · Pro · Enterprise subscription events</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">{t.id}</TableCell>
                  <TableCell>{t.userName}</TableCell>
                  <TableCell>{t.plan}</TableCell>
                  <TableCell className="tabular-nums">{formatMoney(t.amount / 100)}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === 'succeeded' ? 'success' : t.status === 'pending' ? 'warning' : 'danger'}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{new Date(t.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
