import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Only the published library is measured. The demo app, config and
      // barrel are excluded so the percentage reflects shipped behaviour
      // rather than being inflated by re-export lines.
      include: ['lib/**/*.{ts,tsx}'],
      exclude: ['lib/**/*.test.{ts,tsx}', 'lib/index.ts'],
      // Ratchet, not an aspiration: these are the measured numbers at the
      // time coverage was introduced. Raise them as suites land (#29) so a
      // regression fails the run; never lower them to make a build pass.
      thresholds: {
        statements: 56,
        branches: 48,
        functions: 46,
        lines: 55,
      },
    },
  },
});
