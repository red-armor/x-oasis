import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.(spec|test).ts'],
    exclude: ['node_modules/**'],
    threads: false,

    coverage: {
      provider: 'istanbul',
    },
  },

  resolve: {
    alias: {
      '@x-oasis/async-call-rpc': path.resolve(
        __dirname,
        '../async-call-rpc/src/index.ts'
      ),
    },
  },
  define: {
    __DEV__: false,
  },
});
