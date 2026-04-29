import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        hooks: resolve(__dirname, 'src/hooks/index.ts'),
        layers: resolve(__dirname, 'src/layers/index.ts'),
        'layers-r3f': resolve(__dirname, 'src/layers/R3FImmersiveLayer.lazy.tsx'),
        primitives: resolve(__dirname, 'src/primitives/index.ts'),
        runtime: resolve(__dirname, 'src/runtime/index.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) =>
        `${entryName}.${format === 'cjs' ? 'cjs' : 'js'}`,
    },
    rollupOptions: {
      external: [
        '@alphabet/core',
        '@alphabet/api',
        'react',
        'react-dom',
        'react/jsx-runtime',
        '@react-three/fiber',
        'three',
        'clsx',
        '@radix-ui/react-dialog',
        '@radix-ui/react-slot',
        '@radix-ui/react-switch',
        '@radix-ui/react-tabs',
        '@radix-ui/react-tooltip',
      ],
      output: {
        preserveModules: false,
      },
    },
    sourcemap: true,
    minify: false,
  },
});

