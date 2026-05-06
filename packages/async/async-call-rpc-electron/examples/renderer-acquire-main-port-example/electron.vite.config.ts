import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          '@x-oasis/async-call-rpc-electron',
          '@x-oasis/async-call-rpc',
        ],
        include: ['electron'],
      }),
    ],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'main.ts'),
        },
        output: {
          entryFileNames: 'main-process.js',
        },
      },
    },
    resolve: {
      alias: {
        '@x-oasis/async-call-rpc-electron': resolve(
          __dirname,
          '../../src/index.ts'
        ),
        '@x-oasis/async-call-rpc': resolve(
          __dirname,
          '../../../async-call-rpc/src/index.ts'
        ),
      },
    },
  },
  preload: {
    plugins: [
      externalizeDepsPlugin({
        exclude: [
          '@x-oasis/async-call-rpc-electron',
          '@x-oasis/async-call-rpc',
        ],
        include: ['electron'],
      }),
    ],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'preload.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@x-oasis/async-call-rpc-electron': resolve(
          __dirname,
          '../../src/index.ts'
        ),
        '@x-oasis/async-call-rpc': resolve(
          __dirname,
          '../../../async-call-rpc/src/index.ts'
        ),
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
      alias: {
        '@x-oasis/async-call-rpc-electron': resolve(
          __dirname,
          '../../src/index.ts'
        ),
        '@x-oasis/async-call-rpc': resolve(
          __dirname,
          '../../../async-call-rpc/src/index.ts'
        ),
      },
    },
  },
});
