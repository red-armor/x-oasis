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
        input: { main: resolve(__dirname, 'main.ts') },
        output: { entryFileNames: 'main-process.js', format: 'cjs' },
        external: ['electron'],
      },
    },
    resolve: { alias: xOasisAliases },
    server: {
      middlewareMode: false,
      watch: { ignored: ['!**/node_modules/@x-oasis/**'] },
    },
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          'preload-a': resolve(__dirname, 'preload-a.ts'),
          'preload-b': resolve(__dirname, 'preload-b.ts'),
        },
        output: {
          format: 'cjs',
          inlineDynamicImports: false,
        },
        external: ['electron'],
      },
    },
    resolve: { alias: xOasisAliases },
    plugins: [
      {
        name: 'build-utility-workers',
        async closeBundle() {
          for (const workerName of [
            'shared-worker',
            'daemon-worker',
            'setting-pagelet-worker',
          ]) {
            await build({
              build: {
                outDir: resolve(__dirname, 'out/preload'),
                emptyOutDir: false,
                lib: {
                  entry: resolve(__dirname, `${workerName}.ts`),
                  formats: ['cjs'],
                  fileName: () => `${workerName}.js`,
                },
                rollupOptions: {
                  external: ['electron'],
                },
              },
              resolve: {
                alias: xOasisAliases,
              },
            });
          }
        },
      },
    ],
    server: { watch: { ignored: ['!**/node_modules/@x-oasis/**'] } },
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
          setting: resolve(__dirname, 'setting.html'),
        },
      },
    },
    plugins: [react()],
    resolve: { alias: xOasisAliases },
    server: { watch: { ignored: ['!**/node_modules/@x-oasis/**'] } },
  },
});
