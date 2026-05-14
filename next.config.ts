import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/budgy",
  images: { unoptimized: true },
};

export default nextConfig;
