import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    // Integration tests share one SQLite file per worker; running them serially
    // keeps assertions about job state deterministic.
    fileParallelism: false,
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      thresholds: { lines: 75, functions: 75, branches: 70, statements: 75 },
    },
  },
});
