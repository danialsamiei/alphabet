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
    alias: [
      // Order matters: subpaths must come before the bare package alias so
      // that `@awaf/api/mock` does not get rewritten to
      // `<src/index.ts>/mock`.
      { find: '@awaf/api/mock', replacement: resolve(__dirname, '../../packages/api/src/mock/index.ts') },
      { find: '@awaf/api/transport', replacement: resolve(__dirname, '../../packages/api/src/transport/index.ts') },
      { find: '@awaf/ui/styles/tokens.css', replacement: resolve(__dirname, '../../packages/ui/styles/tokens.css') },
      { find: '@awaf/ui', replacement: resolve(__dirname, '../../packages/ui/src/index.ts') },
      { find: '@awaf/core', replacement: resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: '@awaf/api', replacement: resolve(__dirname, '../../packages/api/src/index.ts') },
    ],
  },
  build: {
    sourcemap: true,
  },
});
