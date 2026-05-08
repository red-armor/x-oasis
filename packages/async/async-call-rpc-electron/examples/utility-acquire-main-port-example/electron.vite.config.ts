import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolveXOasisAliases } from './resolve-aliases';
import { build } from 'vite';

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
        },
        external: ['electron'],
      },
    },
    resolve: {
      alias: xOasisAliases,
    },
    plugins: [
      {
        name: 'build-utility-worker',
        async closeBundle() {
          await build({
            build: {
              outDir: resolve(__dirname, 'out/preload'),
              emptyOutDir: false,
              lib: {
                entry: resolve(__dirname, 'utility-worker.ts'),
                formats: ['cjs'],
                fileName: () => 'utility-worker.js',
              },
              rollupOptions: {
                external: ['electron'],
              },
            },
            resolve: {
              alias: xOasisAliases,
            },
          });
        },
      },
    ],
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
