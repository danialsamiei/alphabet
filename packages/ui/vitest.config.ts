import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/index.ts', 'src/__tests__/**'],
    },
  },
  resolve: {
    alias: {
      '@alphabet/core': resolve(__dirname, '../core/src/index.ts'),
      '@alphabet/api': resolve(__dirname, '../api/src/index.ts'),
    },
  },
});
