import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolveXOasisAliases } from './resolve-aliases';

const xOasisAliases = resolveXOasisAliases();

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'main.ts'),
        },
        output: {
          entryFileNames: 'main-process.js',
          format: 'cjs',
        },
        external: ['electron'],
      },
    },
    resolve: {
      alias: xOasisAliases,
    },
    server: {
      middlewareMode: false,
      watch: {
        ignored: ['!**/node_modules/@x-oasis/**'],
      },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'preload.ts'),
        },
        output: {
          format: 'cjs',
          // Electron preload runs in a sandboxed context and cannot load
          // dynamically-required chunk files. Force everything into a single file.
          inlineDynamicImports: true,
        },
        external: ['electron'],
      },
    },
    resolve: {
      alias: xOasisAliases,
    },
    server: {
      watch: {
        ignored: ['!**/node_modules/@x-oasis/**'],
      },
    },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: xOasisAliases,
    },
    server: {
      watch: {
        ignored: ['!**/node_modules/@x-oasis/**'],
      },
    },
  },
});
