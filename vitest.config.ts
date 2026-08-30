import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['lib/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    // Component tests mount ProTable, which pulls in antd's config provider,
    // table, form and portal machinery. That is genuinely slow, and slower
    // again under coverage instrumentation, so the 5s default is too tight.
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Only the published library is measured. The demo app, config and
      // barrel are excluded so the percentage reflects shipped behaviour
      // rather than being inflated by re-export lines.
      include: ['lib/**/*.{ts,tsx}'],
      exclude: ['lib/**/*.test.{ts,tsx}', 'lib/index.ts'],
      // Ratchet, not an aspiration. Raise these as coverage improves; never
      // lower them to make a build pass.
      //
      // Re-baselined once, downward, when the data sources replaced the old
      // hook internals: that removed a fully covered module and grew
      // CrudTable, changing the denominator rather than the coverage of
      // tested code. The component and registry suites then took it from
      // 54% to 87%.
      thresholds: {
        statements: 91,
        branches: 82,
        functions: 92,
        lines: 92,
      },
    },
  },
});
