import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import dts from 'vite-plugin-dts';
import path from 'path';
import { createRequire } from 'module';

const pkg = createRequire(import.meta.url)('./package.json') as {
  dependencies?: Record<string, string>;
};

const peerDeps = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'antd',
  '@ant-design/icons',
  '@ant-design/pro-components',
  'dayjs',
];

// Runtime dependencies are installed alongside the package, so they are
// externalised rather than bundled - otherwise e.g. to-spreadsheet (and the
// JSZip it carries) would be inlined into the bundle and duplicated in a
// consumer that also uses it directly.
const externalPackages = [...peerDeps, ...Object.keys(pkg.dependencies ?? {})];

const isExternal = (id: string) =>
  externalPackages.some((name) => id === name || id.startsWith(`${name}/`));

export default defineConfig({
  plugins: [
    react(),
    dts({
      entryRoot: 'lib',
      outDir: 'dist',
      tsconfigPath: './tsconfig.build.json',
      copyDtsFiles: true,
    }),
  ],
  build: {
    lib: {
      entry: [
        path.resolve(__dirname, 'lib/index.ts'),
        path.resolve(__dirname, 'lib/CrudTable.tsx'),
        path.resolve(__dirname, 'lib/CrudTableLazy.tsx'),
        path.resolve(__dirname, 'lib/hooks/useCrudTable.ts'),
        path.resolve(__dirname, 'lib/hooks/useLocalStorageCrud.ts'),
        path.resolve(__dirname, 'lib/utils/exportData.ts'),
      ],
      formats: ['es', 'cjs']
    },
    outDir: 'dist',
    rollupOptions: {
      external: isExternal,
      output: {
        // The barrel intentionally re-exports CrudTable as default so
        // `import CrudTable from 'antd-crud-table'` keeps working alongside
        // the named exports. Stating this stops rollup guessing the export
        // mode and warning about the mix.
        exports: 'named',
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          antd: 'antd',
        },
      },
    },
  },
});
