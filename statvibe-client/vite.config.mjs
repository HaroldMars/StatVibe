import { basename } from 'node:path';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const pkgRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Client-only Vite config.
 * In local/dev, /api is proxied to the StatVibe server (VITE_API_URL / NEXT_PUBLIC_API_URL).
 * Production static build talks to the same base via public/js/api.js.
 */
function copyPublicShellPlugin() {
  const files = ['sw.js', 'manifest.webmanifest', 'logo-main.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
  return {
    name: 'statvibe-copy-shell',
    closeBundle() {
      const outDir = path.join(pkgRoot, 'dist');
      fs.mkdirSync(outDir, { recursive: true });
      for (const file of files) {
        const src = path.join(pkgRoot, 'public', file);
        if (!fs.existsSync(src)) continue;
        fs.copyFileSync(src, path.join(outDir, file));
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, pkgRoot, '');
  const apiTarget = (env.VITE_API_URL || env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');

  return {
    root: path.join(pkgRoot, 'public'),
    publicDir: false,
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [copyPublicShellPlugin()],
    server: {
      fs: { allow: [pkgRoot, path.join(pkgRoot, 'lib')] },
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
    preview: {
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: path.join(pkgRoot, 'dist'),
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: path.join(pkgRoot, 'public/index.html'),
          admin: path.join(pkgRoot, 'public/admin.html'),
        },
        output: {
          assetFileNames: (assetInfo) => {
            const fixed = new Set(['logo-main.png', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'manifest.webmanifest']);
            const nm = basename(assetInfo.name || '');
            if (fixed.has(nm)) return '[name][extname]';
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
    },
  };
});
