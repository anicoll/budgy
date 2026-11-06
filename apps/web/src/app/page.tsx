import type { Metadata } from "next";
import { Suspense } from "react";
import { Home, HomeFallback } from "@/components/Home";
import { JsonLd } from "@/components/JsonLd";
import { pageMetadata, SITE_DESCRIPTION, SITE_TITLE, siteJsonLd } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  absoluteTitle: true,
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={siteJsonLd()} />
      {/* The home page reads ?view= on the client, so the static HTML carries the
          first-visit page instead of nothing. Crawlers see the tool links. */}
      <Suspense fallback={<HomeFallback />}>
        <Home />
      </Suspense>
    </>
  );
}
