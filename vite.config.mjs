import { createRequire } from 'node:module';
import path from 'node:path';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);
const { requestHandler } = require('./server.js');

function localApiPlugin() {
  const attach = (middlewares) => {
    middlewares.use((req, res, next) => {
      if (req.url === '/admin' || req.url === '/admin/') req.url = '/admin.html';
      if (req.url && req.url.startsWith('/api/')) return requestHandler(req, res);
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

export default defineConfig({
  root: 'public',
  publicDir: false,
  plugins: [localApiPlugin()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve('public/index.html'),
        admin: path.resolve('public/admin.html'),
      },
    },
  },
});
