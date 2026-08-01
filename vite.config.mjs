import { createRequire } from 'node:module';
import { basename } from 'node:path';
import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

// Lazy-load the API handler only for vite dev/preview. Requiring server.js at
// config load time opens MongoDB and keeps the event loop alive, which hangs
// `vite build` (and therefore Vercel static-build) forever.
function getRequestHandler() {
  return require('./server.js').requestHandler;
}

function localApiPlugin() {
  const attach = (middlewares) => {
    middlewares.use((req, res, next) => {
      if (req.url === '/admin' || req.url === '/admin/') req.url = '/admin.html';
      if (req.url && req.url.startsWith('/api/')) return getRequestHandler()(req, res);
      return next();
    });
  };
  return {
    name: 'statvibe-local-api',
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

function copyPublicShellPlugin() {
  const files = ['sw.js'];
  return {
    name: 'statvibe-copy-shell',
    closeBundle() {
      const outDir = path.resolve('dist');
      for (const file of files) {
        fs.copyFileSync(path.resolve('public', file), path.join(outDir, file));
      }
    },
  };
}

export default defineConfig({
  root: 'public',
  publicDir: false,
  plugins: [localApiPlugin(), copyPublicShellPlugin()],
  server: {
    fs: { allow: [path.resolve('.'), path.resolve('lib')] },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve('public/index.html'),
        admin: path.resolve('public/admin.html'),
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
});
