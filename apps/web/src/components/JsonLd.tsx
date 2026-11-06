import { jsonLdString } from "@/lib/seo";

/** Structured data for search engines, rendered into the static HTML. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON built from our own constants, with < escaped.
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}
