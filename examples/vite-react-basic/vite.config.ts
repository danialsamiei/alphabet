import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the Alphabet "vite-react-basic" example.
 *
 * Aliases point at workspace source so the example runs with `pnpm dev`
 * without requiring a prior `pnpm build`. In a real consumer app you
 * would simply `import` from `@alphabet/core` / `@alphabet/ui` and let the
 * resolver use the published `dist/`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@alphabet/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@alphabet/api': resolve(__dirname, '../../packages/api/src/index.ts'),
      '@alphabet/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
  build: {
    sourcemap: true,
  },
});
