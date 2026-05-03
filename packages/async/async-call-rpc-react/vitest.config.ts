import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.(spec|test).ts', 'test/**/*.(spec|test).tsx'],
    exclude: ['node_modules/**'],
    threads: false,

    coverage: {
      provider: 'istanbul',
    },
  },

  resolve: {
    alias: {},
  },
  define: {
    __DEV__: false,
  },
});
