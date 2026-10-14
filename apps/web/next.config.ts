import type { NextConfig } from 'next';

/**
 * The workspace packages ship TypeScript **source**, not compiled output, so
 * Next must transpile them. `transpilePackages` is what lets a single
 * `@lyriclens/ui` be shared by this app, the Tauri shell and Storybook without
 * a build step in between.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lyriclens/ui', '@lyriclens/shared', '@lyriclens/sync-engine'],
  // PWA assets (manifest, service worker, icons) arrive in Phase 2.
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
