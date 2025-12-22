import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    root: __dirname,
    resolveAlias: {
      "@": "./src",
    },
  },
};

export default nextConfig;
