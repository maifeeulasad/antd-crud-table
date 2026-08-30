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
      // Ratchet, not an aspiration. Raise these as suites land (#29) so a
      // regression fails the run; never lower them to make a build pass.
      //
      // Re-baselined once, when the data sources replaced the old hook
      // internals: that removed a fully covered module and grew CrudTable,
      // changing the denominator rather than the coverage of tested code
      // (lib/hooks went 64% -> 87% in the same change). CrudTable.tsx and
      // registry.tsx remain at 0%, which is what #29 exists to fix.
      thresholds: {
        statements: 54,
        branches: 47,
        functions: 44,
        lines: 54,
      },
    },
  },
});
