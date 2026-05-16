import typescript from '@rollup/plugin-typescript';

const external = (id) =>
  id === 'electron' ||
  id === '@x-oasis/async-call-rpc' ||
  id.startsWith('@x-oasis/async-call-rpc/') ||
  id === '@x-oasis/async-call-rpc-web' ||
  id.startsWith('@x-oasis/async-call-rpc-web/');

const tsPlugin = () =>
  typescript({
    tsconfig: './tsconfig.rollup.json',
    declaration: false,
    declarationDir: undefined,
    compilerOptions: {
      outDir: './dist',
    },
  });

export default [
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.js', format: 'esm', sourcemap: true },
    external,
    plugins: [tsPlugin()],
  },
  {
    input: 'src/browser/index.ts',
    output: { file: 'dist/browser/index.js', format: 'esm', sourcemap: true },
    external,
    plugins: [tsPlugin()],
  },
  {
    input: 'src/browser/core.ts',
    output: { file: 'dist/browser/core.js', format: 'esm', sourcemap: true },
    external,
    plugins: [tsPlugin()],
  },
  {
    input: 'src/browser/orchestrator.ts',
    output: {
      file: 'dist/browser/orchestrator.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [tsPlugin()],
  },
  {
    input: 'src/electron-browser/index.ts',
    output: {
      file: 'dist/electron-browser/index.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [tsPlugin()],
  },
  {
    input: 'src/electron-browser/core.ts',
    output: {
      file: 'dist/electron-browser/core.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [tsPlugin()],
  },
  {
    input: 'src/electron-browser/orchestrator.ts',
    output: {
      file: 'dist/electron-browser/orchestrator.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [tsPlugin()],
  },
  {
    input: 'src/electron-main/index.ts',
    output: {
      file: 'dist/electron-main/index.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [tsPlugin()],
  },
  {
    input: 'src/electron-main/core.ts',
    output: {
      file: 'dist/electron-main/core.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [tsPlugin()],
  },
  {
    input: 'src/electron-main/orchestrator.ts',
    output: {
      file: 'dist/electron-main/orchestrator.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [tsPlugin()],
  },
];
