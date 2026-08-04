import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {
    // Keep resolution inside landing/ when nested in the StatVibe monorepo.
    root: path.join(__dirname),
  },
};

export default nextConfig;
