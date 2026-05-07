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
        // 监听 @x-oasis 包的文件变更
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
