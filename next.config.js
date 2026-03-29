/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow production builds while lint issues are addressed incrementally
    ignoreDuringBuilds: true,
  },
  images: {
    // Storage public URLs: https://<project-ref>.supabase.co/storage/v1/object/public/...
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
}

module.exports = nextConfig
