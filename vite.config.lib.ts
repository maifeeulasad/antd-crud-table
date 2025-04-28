import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import dts from 'vite-plugin-dts';
import path from 'path';

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
      entry: [path.resolve(__dirname, 'lib/CrudTable.tsx'), path.resolve(__dirname, 'lib/CrudTableLazy.tsx')],
      formats: ['es', 'cjs']
    },
    outDir: 'dist',
    rollupOptions: {
      external: ['react', 'react-dom', 'antd', '@ant-design/icons', '@ant-design/pro-components', 'date-fns', 'dayjs'],
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
