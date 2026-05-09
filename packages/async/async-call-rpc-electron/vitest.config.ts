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
      '@x-oasis/async-call-rpc-web': path.resolve(
        __dirname,
        '../async-call-rpc-web/src/index.ts'
      ),
      // Mock electron module so tests run outside Electron
      electron: path.resolve(__dirname, 'test/__mocks__/electron.ts'),
    },
  },
  define: {
    __DEV__: false,
  },
});
