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
      '@x-oasis/async-call-rpc/core': path.resolve(
        __dirname,
        '../async-call-rpc/src/core.ts'
      ),
      '@x-oasis/async-call-rpc/orchestrator': path.resolve(
        __dirname,
        '../async-call-rpc/src/orchestrator/index.ts'
      ),
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
