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
    resolve: { alias: xOasisAliases },
    plugins: [
      {
        name: 'build-utility-workers',
        async closeBundle() {
          // Build each utility-worker separately after the preload build finishes.
          // utility-workers run as Node.js utilityProcesses (not preload scripts),
          // so they must be compiled independently to avoid code-splitting —
          // Electron's sandboxed preload cannot load chunks.
          for (const workerName of ['utility-worker-a', 'utility-worker-b']) {
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
      rollupOptions: { input: { index: resolve(__dirname, 'index.html') } },
    },
    plugins: [react()],
    resolve: { alias: xOasisAliases },
    server: { watch: { ignored: ['!**/node_modules/@x-oasis/**'] } },
  },
});
