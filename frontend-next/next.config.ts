import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the self-contained Node.js image used by Azure Container Apps.
  output: "standalone",
};

export default nextConfig;
