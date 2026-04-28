import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the Danial Samiei personal site.
 *
 * - Aliases AWAF packages to source so `pnpm dev` works without a
 *   prior monorepo build (matches `apps/demo` convention).
 * - Proxies `/api/assistant` to the local Node proxy
 *   (`server.mjs`, default :8787) which holds the GITHUB_TOKEN
 *   server-side so it never reaches the browser.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@awaf/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@awaf/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/api/assistant': {
        target: process.env.ASSISTANT_PROXY_URL ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: true,
  },
});
