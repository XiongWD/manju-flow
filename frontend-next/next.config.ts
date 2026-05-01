import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  allowedDevOrigins: [
    "192.168.0.107",
    "localhost",
    "0.0.0.0",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
  // Prevent Next.js from stripping/redirecting trailing slashes on /api/* routes
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
