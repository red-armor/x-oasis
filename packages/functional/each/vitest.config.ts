// import path from 'path';
// import tsPath from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// const __dirname = import.meta.url.slice(7, import.meta.url.lastIndexOf('/'));

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.(spec|test).ts'],
    exclude: ['node_modules/**'],
    threads: false,

    coverage: {
      provider: 'istanbul', // or 'c8'
    },
  },

  // plugins: [tsPath()],
  resolve: {
    alias: {},
  },
  define: {
    __DEV__: false,
  },
});
