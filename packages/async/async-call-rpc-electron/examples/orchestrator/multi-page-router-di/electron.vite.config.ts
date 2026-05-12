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
          main: resolve(
            __dirname,
            'src/apps/main/application/electron-main/main.ts'
          ),
        },
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
          preload: resolve(
            __dirname,
            'src/apps/main/application/electron-browser/preload.ts'
          ),
        },
        output: {
          format: 'cjs',
          inlineDynamicImports: true,
        },
        external: ['electron'],
      },
    },
    resolve: { alias: xOasisAliases },
    plugins: [
      {
        name: 'build-utility-workers',
        async closeBundle() {
          const workers = [
            {
              entry: 'src/apps/daemon/application/node/main.ts',
              outName: 'daemon-worker',
            },
            {
              entry: 'src/apps/shared/application/node/main.ts',
              outName: 'shared-worker',
            },
            {
              entry: 'src/apps/pagelet/application/node/pagelet-A-main.ts',
              outName: 'pagelet-A-worker',
            },
            {
              entry: 'src/apps/pagelet/application/node/pagelet-B-main.ts',
              outName: 'pagelet-B-worker',
            },
            {
              entry: 'src/apps/pagelet/application/node/pagelet-C-main.ts',
              outName: 'pagelet-C-worker',
            },
          ];
          for (const w of workers) {
            await build({
              build: {
                outDir: resolve(__dirname, 'out/preload'),
                emptyOutDir: false,
                lib: {
                  entry: resolve(__dirname, w.entry),
                  formats: ['cjs'],
                  fileName: () => `${w.outName}.js`,
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
      rollupOptions: { input: { index: resolve(__dirname, 'index.html') } },
    },
    plugins: [react()],
    resolve: { alias: xOasisAliases },
    server: { watch: { ignored: ['!**/node_modules/@x-oasis/**'] } },
  },
});
