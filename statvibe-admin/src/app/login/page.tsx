'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      router.replace(params.get('next') || '/dashboard');
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-[radial-gradient(1200px_600px_at_10%_-10%,#dbe4ff,transparent),radial-gradient(900px_500px_at_90%_0%,#e8edff,transparent),#f4f6fb] p-6">
      <Card className="w-full max-w-md border-[#d7def7] shadow-xl shadow-indigo-500/10">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#5865f2] text-white grid place-items-center font-bold">SV</div>
            <div>
              <CardTitle>StatVibe Admin</CardTitle>
              <CardDescription>Secure console for founders &amp; employees</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            <Button className="w-full bg-[#5865f2] hover:bg-[#4654e0]" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Seeded CEO: set <code>ADMIN_CEO_USERNAME</code> / <code>ADMIN_CEO_PASSWORD</code> in production.
              Defaults use the founder seed from StatVibe.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
