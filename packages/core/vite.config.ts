import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'contracts/runtime/index': resolve(
          __dirname,
          'src/contracts/runtime/index.ts',
        ),
        'effect/index': resolve(__dirname, 'src/effect/index.ts'),
        'memory/index': resolve(__dirname, 'src/memory/index.ts'),
        'oracle/index': resolve(__dirname, 'src/oracle/index.ts'),
        'privacy-wasm/index': resolve(__dirname, 'src/privacy-wasm/index.ts'),
        'orchestrator/index': resolve(__dirname, 'src/orchestrator/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'cjs' ? 'cjs' : 'js'}`,
    },
    rollupOptions: {
      external: [],
      output: {
        preserveModules: false,
      },
    },
    sourcemap: true,
    minify: false,
  },
});
