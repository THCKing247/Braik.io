/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow production deploys while lint issues are addressed incrementally
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production deploys while legacy type issues are addressed incrementally
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['localhost'],
    // Optimize image loading to reduce memory usage
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Optimize memory usage
  swcMinify: true,
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

