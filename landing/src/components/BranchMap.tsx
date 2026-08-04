'use client';

import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus } from 'lucide-react';

type Branch = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  revenue: string;
  staff: number;
  stock: 'Healthy' | 'Low' | 'Critical';
};

const INITIAL: Branch[] = [
  {
    id: 'cebu',
    name: 'Cebu Central',
    lat: 10.3157,
    lng: 123.8854,
    revenue: '₱42,800',
    staff: 12,
    stock: 'Healthy',
  },
  {
    id: 'manila',
    name: 'Manila Hub',
    lat: 14.5995,
    lng: 120.9842,
    revenue: '₱67,150',
    staff: 18,
    stock: 'Low',
  },
  {
    id: 'davao',
    name: 'Davao Branch',
    lat: 7.1907,
    lng: 125.4553,
    revenue: '₱28,940',
    staff: 9,
    stock: 'Healthy',
  },
];

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#5B67FA;border:3px solid #fff;box-shadow:0 2px 10px rgba(24,33,63,.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -10],
});

function stockColor(s: Branch['stock']) {
  if (s === 'Critical') return '#c45c4a';
  if (s === 'Low') return '#c48a2e';
  return '#2f9d78';
}

function ClickToAdd({ enabled, onAdd }: { enabled: boolean; onAdd: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function BranchMap() {
  const [branches, setBranches] = useState(INITIAL);
  const [adding, setAdding] = useState(false);
  const center = useMemo<[number, number]>(() => [11.5, 122.5], []);

  function addAt(lat: number, lng: number) {
    const n = branches.length + 1;
    setBranches((prev) => [
      ...prev,
      {
        id: `demo-${Date.now()}`,
        name: `New Branch ${n}`,
        lat,
        lng,
        revenue: '₱0',
        staff: 1,
        stock: 'Healthy',
      },
    ]);
    setAdding(false);
  }

  return (
    <div className="relative h-full w-full">
      <div className="absolute left-3 top-3 z-[500] flex gap-2">
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={[
            'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold shadow-md transition',
            adding
              ? 'bg-[var(--ink)] text-white'
              : 'border border-[var(--line)] bg-white/95 text-[var(--ink-2)] hover:border-[var(--primary)]',
          ].join(' ')}
        >
          <Plus size={14} />
          {adding ? 'Tap map to place…' : 'Add demo branch'}
        </button>
      </div>

      <MapContainer center={center} zoom={6} scrollWheelZoom={false} className="h-full w-full" style={{ height: '100%', width: '100%' }}>
        <TileLayer attribution="" url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
        <ClickToAdd enabled={adding} onAdd={addAt} />
        {branches.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={pinIcon}>
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{b.name}</div>
                <div style={{ fontSize: 12, color: '#6b7599' }}>Daily revenue</div>
                <div style={{ fontWeight: 600, fontFamily: 'ui-monospace, monospace', marginBottom: 6 }}>{b.revenue}</div>
                <div style={{ fontSize: 12 }}>
                  Staff: <b>{b.staff}</b>
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Stock:{' '}
                  <b style={{ color: stockColor(b.stock) }}>{b.stock}</b>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
