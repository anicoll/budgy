import { describe, expect, it } from "vitest";
import { jsonLdString, pagePath, TOOL_SEO, toolJsonLd, toolMetadata } from "./seo";
import { TOOLS } from "./tools";

describe("seo", () => {
  it("has a title and description for every tool", () => {
    for (const t of TOOLS) {
      const seo = TOOL_SEO[t.key];
      expect(seo, t.key).toBeDefined();
      // Room for the " · budgy" suffix before Google cuts the title off.
      expect(seo.title.length, t.key).toBeLessThanOrEqual(60);
      expect(seo.description.length, t.key).toBeGreaterThan(80);
    }
  });

  it("gives each tool a trailing-slash canonical that matches the export", () => {
    const m = toolMetadata("pay");
    expect(m.alternates?.canonical).toBe("/pay/");
    expect(m.openGraph?.url).toBe("/pay/");
    expect(pagePath("/")).toBe("/");
    expect(pagePath("/pay/")).toBe("/pay/");
  });

  it("describes a tool as a free Australian web app", () => {
    const graph = toolJsonLd("help")["@graph"] as Record<string, unknown>[];
    const app = graph[0];
    expect(app["@type"]).toBe("WebApplication");
    expect(app.url).toBe("https://budgy.nicoll.dev/pay-off-help/");
    expect(app.offers).toMatchObject({ price: "0", priceCurrency: "AUD" });
  });

  it("escapes < so the JSON can't close its script tag", () => {
    expect(jsonLdString({ a: "</script>" })).not.toContain("</");
  });
});
