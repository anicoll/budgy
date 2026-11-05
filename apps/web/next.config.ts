import type { NextConfig } from "next";

// The site is served from the root of https://budgy.nicoll.dev, so BASE_PATH
// is normally empty. Set it only to host the export under a sub-path.
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
