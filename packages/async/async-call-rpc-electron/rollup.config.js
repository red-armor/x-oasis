import typescript from '@rollup/plugin-typescript';

export default [
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    external: [
      'electron',
      '@x-oasis/async-call-rpc',
      '@x-oasis/async-call-rpc-web',
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.rollup.json',
        compilerOptions: {
          outDir: './dist',
        },
      }),
    ],
  },
  {
    input: 'src/browser/index.ts',
    output: {
      file: 'dist/browser/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    external: [
      'electron',
      '@x-oasis/async-call-rpc',
      '@x-oasis/async-call-rpc-web',
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.rollup.json',
        compilerOptions: {
          outDir: './dist',
        },
      }),
    ],
  },
  {
    input: 'src/electron-browser/index.ts',
    output: {
      file: 'dist/electron-browser/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    external: [
      'electron',
      '@x-oasis/async-call-rpc',
      '@x-oasis/async-call-rpc-web',
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.rollup.json',
        compilerOptions: {
          outDir: './dist',
        },
      }),
    ],
  },
  {
    input: 'src/electron-main/index.ts',
    output: {
      file: 'dist/electron-main/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    external: [
      'electron',
      '@x-oasis/async-call-rpc',
      '@x-oasis/async-call-rpc-web',
    ],
    plugins: [
      typescript({
        tsconfig: './tsconfig.rollup.json',
        compilerOptions: {
          outDir: './dist',
        },
      }),
    ],
  },
];
