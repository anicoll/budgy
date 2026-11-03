import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Budgy — Personal finance",
    short_name: "Budgy",
    description: "Local-first personal budgeting app",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0f1e",
    theme_color: "#0a0f1e",
    orientation: "portrait-primary",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [],
    shortcuts: [
      {
        name: "Dashboard",
        url: "/dashboard",
        description: "Go to dashboard",
      },
      {
        name: "Add transaction",
        url: "/transactions",
        description: "Add a new transaction",
      },
    ],
  };
}
