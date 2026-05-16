import typescript from '@rollup/plugin-typescript';

const external = (id) =>
  id === '@x-oasis/async-call-rpc' ||
  id.startsWith('@x-oasis/async-call-rpc/') ||
  id === '@x-oasis/async-call-rpc-web';

const plugins = [
  typescript({
    tsconfig: './tsconfig.build.json',
    declaration: false,
    declarationDir: undefined,
  }),
];

export default [
  {
    input: 'src/core.ts',
    output: [
      { file: 'dist/core.js', format: 'cjs', sourcemap: true },
      { file: 'dist/core.esm.js', format: 'esm', sourcemap: true },
    ],
    external,
    plugins,
  },
  {
    input: 'src/orchestrator.ts',
    output: [
      { file: 'dist/orchestrator.js', format: 'cjs', sourcemap: true },
      { file: 'dist/orchestrator.esm.js', format: 'esm', sourcemap: true },
    ],
    external,
    plugins,
  },
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.js', format: 'cjs', sourcemap: true },
      {
        file: 'dist/async-call-rpc-web.esm.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    external,
    plugins,
  },
];
