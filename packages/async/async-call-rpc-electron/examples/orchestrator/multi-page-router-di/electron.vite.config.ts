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
        name: 'build-extra-preloads-and-workers',
        async closeBundle() {
          const extraPreloads = [
            {
              entry: 'src/apps/setting/application/electron-browser/preload.ts',
              outName: 'setting-preload',
            },
          ];
          for (const p of extraPreloads) {
            await build({
              build: {
                outDir: resolve(__dirname, 'out/preload'),
                emptyOutDir: false,
                lib: {
                  entry: resolve(__dirname, p.entry),
                  formats: ['cjs'],
                  fileName: () => `${p.outName}.js`,
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
              entry: 'src/apps/connection/application/node/main.ts',
              outName: 'connection-worker',
            },
            {
              entry: 'src/apps/monitor/application/node/main.ts',
              outName: 'monitor-worker',
            },
            {
              entry: 'src/apps/setting/application/node/main.ts',
              outName: 'setting-worker',
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
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
          setting: resolve(__dirname, 'setting.html'),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: [
        ...xOasisAliases,
        { find: '@', replacement: resolve(__dirname, 'src') },
      ],
    },
    css: {
      postcss: './postcss.config.js',
    },
    server: { watch: { ignored: ['!**/node_modules/@x-oasis/**'] } },
  },
});
