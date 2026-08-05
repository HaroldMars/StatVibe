'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type UserRow = {
  id: string;
  name: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'SUSPENDED';
  plan: string;
  createdAt: string;
};

function statusVariant(status: UserRow['status']) {
  if (status === 'APPROVED') return 'success' as const;
  if (status === 'PENDING') return 'warning' as const;
  return 'danger' as const;
}

export default function UsersPage() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async (query = q) => {
    const res = await fetch(`/api/users?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    setUsers(data.users || []);
  }, [q]);

  useEffect(() => {
    load('');
  }, [load]);

  async function setStatus(id: string, status: UserRow['status']) {
    setBusyId(id);
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await load();
    setBusyId('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-slate-500">Names are half-masked for privacy in every admin response.</p>
      </div>
      <Card className="border-[#dde3f5]">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>App users</CardTitle>
            <CardDescription>Search, review status, and approve or suspend accounts.</CardDescription>
          </div>
          <form
            className="flex w-full max-w-sm gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load(q);
            }}
          >
            <Input placeholder="Search name, email, id…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Button type="submit" variant="secondary">Search</Button>
          </form>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-slate-500">{u.email}</TableCell>
                  <TableCell>{u.plan}</TableCell>
                  <TableCell><Badge variant={statusVariant(u.status)}>{u.status}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    {u.status !== 'APPROVED' ? (
                      <Button size="sm" disabled={busyId === u.id} onClick={() => setStatus(u.id, 'APPROVED')}>Approve</Button>
                    ) : null}
                    {u.status !== 'SUSPENDED' ? (
                      <Button size="sm" variant="outline" disabled={busyId === u.id} onClick={() => setStatus(u.id, 'SUSPENDED')}>Suspend</Button>
                    ) : null}
                    {u.status === 'SUSPENDED' ? (
                      <Button size="sm" variant="secondary" disabled={busyId === u.id} onClick={() => setStatus(u.id, 'PENDING')}>Reopen</Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
