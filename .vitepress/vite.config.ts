import { defineConfig } from 'vite';

export default defineConfig({
  ssr: {
    noExternal: ['dayjs'],
  },
  optimizeDeps: {
    include: ['dayjs'],
  },
});
