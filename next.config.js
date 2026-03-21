/** @type {import('next').NextConfig} */
const nextConfig = {
  /**
   * Static HTML export → writes `out/` for Capacitor (`webDir: 'out'` in capacitor.config.ts).
   *
   * After a successful web build:
   *   - Run `npm run build` to generate `/out`
   *   - Run `npx cap sync android` to copy assets into the Android project
   *
   * Note: `rewrites` / `redirects` / `headers` are not supported with `output: 'export'`.
   * Serve `/favicon.ico` from `public/favicon.ico` (or a static file) instead of rewrites.
   *
   * This app uses many dynamic API routes, Server Actions, and `force-dynamic` patterns;
   * a full static export may require additional refactors per Next.js static export docs.
   */
  output: 'export',
  transpilePackages: [
    '@capacitor/core',
    '@capacitor/preferences',
    '@aparajita/capacitor-biometric-auth',
  ],
  eslint: {
    // Allow production deploys while lint issues are addressed incrementally
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Block deploys on TypeScript errors to avoid runtime regressions in production.
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    domains: ['localhost', 'braik.io'],
    // Add your Supabase project hostname (e.g. abc123.supabase.co) when using Next Image with storage
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  compiler: {
    // Remove console logs in production to reduce bundle size
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Reduce memory footprint during development
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  // Optimize webpack for memory
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Reduce memory usage during development
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules/,
      };
    }
    return config;
  },
}

module.exports = nextConfig
