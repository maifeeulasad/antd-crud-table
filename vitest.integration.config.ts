import { defineConfig } from 'vitest/config';

// Integration tests drive RestDataSource against the dev backend over real
// HTTP. They run in node rather than jsdom - there is no DOM involved - and
// sequentially, because they share one server and reset its state per test.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 45_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
