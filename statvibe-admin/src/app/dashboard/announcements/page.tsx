'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

type Note = {
  id: string;
  title: string;
  body: string;
  category: string;
  channels: string[];
  startsAt?: number;
  endsAt?: number | null;
  dismissible: boolean;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  active: boolean;
};

const CATEGORIES = [
  { id: 'maintenance', label: 'Scheduled Maintenance' },
  { id: 'sale', label: 'Big Sale / Promo' },
  { id: 'system_update', label: 'System Update' },
  { id: 'urgent', label: 'Urgent Alert' },
];

export default function AnnouncementsPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('sale');
  const [ctaLabel, setCtaLabel] = useState('Upgrade to Beta Sale');
  const [ctaUrl, setCtaUrl] = useState('/#plans');
  const [dismissible, setDismissible] = useState(true);
  const [channelInApp, setChannelInApp] = useState(true);
  const [channelEmail, setChannelEmail] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    fetch('/api/billing/notifications')
      .then((r) => r.json())
      .then((d) => setNotes(d.notifications || []));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function publish() {
    setMsg('');
    const channels = [
      ...(channelInApp ? ['in_app'] : []),
      ...(channelEmail ? ['email'] : []),
    ];
    const r = await fetch('/api/billing/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        category,
        channels,
        dismissible,
        ctaLabel: ctaLabel || null,
        ctaUrl: ctaUrl || null,
        active: true,
      }),
    });
    const d = await r.json();
    if (r.ok) {
      setTitle('');
      setBody('');
      setMsg('Broadcast published');
      load();
    } else setMsg(d.error || 'Failed');
  }

  async function remove(id: string) {
    await fetch(`/api/billing/notifications/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Announcements</h1>
        <p className="text-sm text-slate-500">Site-wide or targeted system notifications · in-app banner and email trigger</p>
      </div>
      {msg ? <p className="text-sm text-slate-600">{msg}</p> : null}

      <Card className="border-[#dde3f5]">
        <CardHeader>
          <CardTitle>Compose broadcast</CardTitle>
          <CardDescription>Categories: maintenance, sale, system update, urgent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Beta sale is live" />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <textarea
              className="min-h-[88px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Pro is $10 + 12% VAT for first-time subscribers."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>CTA label</Label>
              <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>CTA link</Label>
              <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={channelInApp} onChange={(e) => setChannelInApp(e.target.checked)} /> In-app</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={channelEmail} onChange={(e) => setChannelEmail(e.target.checked)} /> Email broadcast</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={dismissible} onChange={(e) => setDismissible(e.target.checked)} /> Dismissible</label>
          </div>
          <Button onClick={publish}>Publish</Button>
        </CardContent>
      </Card>

      <Card className="border-[#dde3f5]">
        <CardHeader>
          <CardTitle>Active & scheduled</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500">No announcements yet.</p>
          ) : (
            notes.map((n) => (
              <div key={n.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{n.title}</span>
                    <Badge>{n.category}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{n.body}</p>
                  {n.ctaLabel ? <p className="mt-1 text-xs text-slate-500">{n.ctaLabel} → {n.ctaUrl}</p> : null}
                </div>
                <Button variant="outline" size="sm" onClick={() => remove(n.id)}>Remove</Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
