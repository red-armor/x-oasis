import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// 如果设置了 GITHUB_PAGES 环境变量，使用仓库名和子路径作为 base 路径
// 格式: owner/repo-name，我们只需要 repo-name
// 子路径从 GITHUB_PAGES_PATH 环境变量获取，例如: diff-match-patch
const getBasePath = () => {
  if (process.env.GITHUB_PAGES === 'true') {
    const repo = process.env.GITHUB_REPOSITORY || 'red-armor/x-oasis';
    const repoName = repo.split('/')[1];
    const subPath = process.env.GITHUB_PAGES_PATH || 'diff-match-patch';
    return `/${repoName}/${subPath}/`;
  }
  return '/';
};

export default defineConfig({
  base: getBasePath(),
  plugins: [react()],
  resolve: {
    alias: {
      '@x-oasis/diff-match-patch': path.resolve(__dirname, '../src/index.ts'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
