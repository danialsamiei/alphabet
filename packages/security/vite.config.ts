import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'privacy/index': resolve(__dirname, 'src/privacy/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'cjs' ? 'cjs' : 'js'}`,
    },
    rollupOptions: {
      external: ['@alphabet/core'],
      output: {
        preserveModules: false,
      },
    },
    sourcemap: true,
    minify: false,
  },
});
