import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

/**
 * Vite config for the AWAF demo app.
 *
 * Aliases point at the package source so `pnpm dev` works without a
 * prior `pnpm build`. The production `pnpm build` script runs `tsc`
 * first, which uses the `paths` mapping in `tsconfig.json` to resolve
 * the same packages against their built `dist/index.d.ts`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@awaf/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@awaf/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@awaf/api': resolve(__dirname, '../../packages/api/src/index.ts'),
    },
  },
  build: {
    sourcemap: true,
  },
});
