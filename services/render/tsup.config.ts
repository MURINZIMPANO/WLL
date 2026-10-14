import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  skipNodeModulesBundle: true,
  splitting: true,
  sourcemap: true,
  clean: true,
});
