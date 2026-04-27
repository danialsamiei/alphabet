import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the AWAF "vite-react-basic" example.
 *
 * Aliases point at workspace source so the example runs with `pnpm dev`
 * without requiring a prior `pnpm build`. In a real consumer app you
 * would simply `import` from `@awaf/core` / `@awaf/ui` and let the
 * resolver use the published `dist/`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@awaf/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@awaf/api': resolve(__dirname, '../../packages/api/src/index.ts'),
      '@awaf/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
    },
  },
  build: {
    sourcemap: true,
  },
});
