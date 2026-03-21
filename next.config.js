/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow production builds while lint issues are addressed incrementally
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
