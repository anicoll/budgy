import type { MetadataRoute } from "next";

// Needed for a static export.
export const dynamic = "force-static";

// Icon paths are relative so they resolve under any base path.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "budgy: free Australian money tools",
    short_name: "budgy",
    description: "Free, private financial calculators for Australians.",
    start_url: ".",
    display: "standalone",
    background_color: "#f8fafa",
    theme_color: "#0e5561",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
