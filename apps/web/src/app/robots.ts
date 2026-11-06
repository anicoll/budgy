import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Needed for a static export.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    // The import page stays crawlable so search engines can see its noindex.
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
