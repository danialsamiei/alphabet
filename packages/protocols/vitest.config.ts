import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@awaf/core': resolve(__dirname, '../core/src'),
      '@awaf/api': resolve(__dirname, '../api/src'),
    },
  },
});
