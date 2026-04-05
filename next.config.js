/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Tree-shake icon / UI packages so routes only ship icons/components actually used.
    optimizePackageImports: ["lucide-react"],
  },
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
