import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import dts from 'vite-plugin-dts';
import path from 'path';

const peerDeps = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'antd',
  '@ant-design/icons',
  '@ant-design/pro-components',
  'date-fns',
  'dayjs',
];

const isExternal = (id: string) =>
  peerDeps.some((pkg) => id === pkg || id.startsWith(`${pkg}/`));

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
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          antd: 'antd',
        },
      },
    },
  },
});
