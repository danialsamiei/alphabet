import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@awaf/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@awaf/core': resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
});
