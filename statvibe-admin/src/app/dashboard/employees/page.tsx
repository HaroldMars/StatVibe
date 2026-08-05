'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Employee = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  createdAt: string;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch('/api/employees');
    const data = await res.json();
    if (res.ok) setEmployees(data.employees || []);
    else setError(data.error || 'Unable to load employees');
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || 'Could not create employee');
      return;
    }
    setOk(`Created employee ${data.employee.username}`);
    setUsername('');
    setDisplayName('');
    setPassword('');
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
        <p className="text-sm text-slate-500">CEO_FOUNDER only — create employee admin accounts with custom credentials.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-[#dde3f5]">
          <CardHeader>
            <CardTitle>Add employee</CardTitle>
            <CardDescription>New accounts receive the EMPLOYEE role.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
              <Button disabled={busy} className="bg-[#5865f2] hover:bg-[#4654e0]">{busy ? 'Creating…' : 'Create employee'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-[#dde3f5]">
          <CardHeader>
            <CardTitle>Admin roster</CardTitle>
            <CardDescription>Display names are masked in API responses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.username}</TableCell>
                    <TableCell>{e.displayName}</TableCell>
                    <TableCell>
                      <Badge variant={e.role === 'CEO_FOUNDER' ? 'default' : 'secondary'}>{e.role}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
