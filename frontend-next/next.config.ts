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
      { source: "/api/projects", destination: "http://localhost:8000/api/projects/" },
      { source: "/api/apikeys", destination: "http://localhost:8000/api/apikeys/" },
      { source: "/api/jobs", destination: "http://localhost:8000/api/jobs/" },
      { source: "/api/assets", destination: "http://localhost:8000/api/assets/" },
      { source: "/api/scenes", destination: "http://localhost:8000/api/scenes/" },
      { source: "/api/episodes", destination: "http://localhost:8000/api/episodes/" },
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
