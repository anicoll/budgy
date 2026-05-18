import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: "export",
  basePath: "/budgy",
  images: { unoptimized: true },
};

export default nextConfig;
