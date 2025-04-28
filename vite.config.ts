import { defineConfig } from 'vite'
// import { resolve } from 'path'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  // build: {
  //   lib: {
  //     entry: resolve(__dirname, 'lib/main.ts'),
  //     formats: ['es']
  //   }
  // }
})