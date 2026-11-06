import type { MetadataRoute } from "next";
import { pagePath, SITE_URL } from "@/lib/seo";
import { TOOLS } from "@/lib/tools";

// Needed for a static export.
export const dynamic = "force-static";

/** Every page worth indexing. The import page and home views (?view=) are left out. */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (href: string) => `${SITE_URL}${pagePath(href)}`;
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    ...TOOLS.map((t) => ({
      url: url(t.href),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    { url: url("/privacy"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
