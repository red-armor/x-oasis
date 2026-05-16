import typescript from '@rollup/plugin-typescript';

const external = [
  '@x-oasis/deferred',
  '@x-oasis/disposable',
  '@x-oasis/emitter',
  '@x-oasis/id',
  '@x-oasis/is-ascii',
  '@x-oasis/is-function',
  '@x-oasis/is-object',
  '@x-oasis/is-promise',
];

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
    input: 'src/orchestrator/index.ts',
    output: [
      { file: 'dist/orchestrator.js', format: 'cjs', sourcemap: true },
      { file: 'dist/orchestrator.esm.js', format: 'esm', sourcemap: true },
    ],
    external: [...external, '@x-oasis/async-call-rpc'],
    plugins,
  },
  {
    input: 'src/index.ts',
    output: [
      { file: 'dist/index.js', format: 'cjs', sourcemap: true },
      { file: 'dist/async-call-rpc.esm.js', format: 'esm', sourcemap: true },
    ],
    external,
    plugins,
  },
];
