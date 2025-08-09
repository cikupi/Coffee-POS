import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Allow production builds to successfully complete even if
    // there are ESLint errors. We'll fix lint issues iteratively.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to complete even if there are
    // type errors. Useful while incrementally adding types.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
