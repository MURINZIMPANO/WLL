import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/app.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  // Workspace packages ship TypeScript source, so tsup transpiles them into the
  // output rather than treating them as external.
  skipNodeModulesBundle: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
});
