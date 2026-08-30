import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Demo app. Deployed at the root of the published site, with the Storybook
// playground under /storybook and the API reference under /api.
//
// Output goes to dist-site, not dist: dist is the published package
// (`files: ["dist"]`), and writing the demo there risked a stale demo build
// being packed into a release.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist-site',
    emptyOutDir: true,
  },
});
