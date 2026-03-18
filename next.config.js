/** @type {import('next').NextConfig} */
const nextConfig = {
  // Serve favicon from existing logo so /favicon.ico does not 404
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/braik-logo.png' }]
  },
  eslint: {
    // Allow production deploys while lint issues are addressed incrementally
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Block deploys on TypeScript errors to avoid runtime regressions in production.
    ignoreBuildErrors: false,
  },
  images: {
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
      // Reduce memory usage in development
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

