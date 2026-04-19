/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/dashboard/coach", destination: "/dashboard" },
      { source: "/dashboard/coach/:path*", destination: "/dashboard/:path*" },
      { source: "/dashboard/player", destination: "/dashboard" },
      { source: "/dashboard/player/:path*", destination: "/dashboard/:path*" },
      { source: "/dashboard/parent", destination: "/dashboard" },
      { source: "/dashboard/parent/:path*", destination: "/dashboard/:path*" },
      { source: "/dashboard/recruiter", destination: "/dashboard/recruiting" },
      { source: "/dashboard/recruiter/:path*", destination: "/dashboard/recruiting/:path*" },
    ]
  },
  experimental: {
    // Tree-shake icon / UI packages so routes only ship icons/components actually used.
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-popover",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
    ],
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
      /** Apex Showroom demo — curated Unsplash photography */
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
}

module.exports = nextConfig
