import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      exclude: ['node_modules/', 'dist/', '**/*.d.ts', '**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@awaf/core': resolve(__dirname, './src'),
    },
  },
});
