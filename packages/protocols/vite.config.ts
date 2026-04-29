import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'direct-api': resolve(__dirname, 'src/direct-api/index.ts'),
        mcp: resolve(__dirname, 'src/mcp/index.ts'),
        a2a: resolve(__dirname, 'src/a2a/index.ts'),
        'qr-handoff': resolve(__dirname, 'src/qr-handoff/index.ts'),
        normalizers: resolve(__dirname, 'src/normalizers/index.ts'),
        errors: resolve(__dirname, 'src/errors/index.ts'),
        'ai-sdk': resolve(__dirname, 'src/ai-sdk/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'cjs' ? 'cjs' : 'js'}`,
    },
    rollupOptions: {
      external: ['@alphabet/core', '@alphabet/api'],
      output: {
        preserveModules: false,
      },
    },
    sourcemap: true,
    minify: false,
  },
});
