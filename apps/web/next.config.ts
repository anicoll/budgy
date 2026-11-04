import type { NextConfig } from "next";

// GitHub Pages serves the site from /budgy, so the deploy workflow sets
// BASE_PATH=/budgy. Locally and on a root domain it stays empty.
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Every page is exported as <route>/index.html, so relative links like
  // ".." and "../pay" resolve correctly under any base path.
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@budgy/engine"],
};

export default nextConfig;
