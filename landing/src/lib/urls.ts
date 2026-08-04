export function clientUrl(): string {
  const raw = process.env.NEXT_PUBLIC_CLIENT_URL || 'https://stat-vibe.vercel.app/';
  return raw.endsWith('/') ? raw : raw + '/';
}

export function serverUrl(): string {
  return process.env.NEXT_PUBLIC_SERVER_URL || 'https://statvibe-server.vercel.app';
}
