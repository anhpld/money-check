import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["192.168.1.15"],

  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
      allowedOrigins: [
        "34.21.166.188:3005",
        "127.0.0.1:3005",
        "localhost:3005",
        "fcdongdo.duckdns.org",
        "34.21.166.188:3000",
        "127.0.0.1:3000",
        "localhost:3000",
      ],
    },
  },

  outputFileTracingIncludes: {
    "*": ["./node_modules/@swc/helpers/esm/**"],
  },
};

export default nextConfig;
