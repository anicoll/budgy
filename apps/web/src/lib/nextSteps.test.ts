import { describe, expect, it } from "vitest";
import { NEXT } from "@/components/NextSteps";
import type { ToolKey } from "./saved";
import { TOOLS } from "./tools";

describe("next steps", () => {
  it("links every tool to other real tools, without repeats", () => {
    const keys = new Set(TOOLS.map((t) => t.key));
    for (const t of TOOLS) {
      const next = NEXT[t.key as ToolKey] ?? [];
      expect(next.length, t.key).toBeGreaterThan(0);
      const to = next.map((n) => n.to);
      expect(new Set(to).size).toBe(to.length);
      for (const k of to) {
        expect(keys.has(k)).toBe(true);
        expect(k).not.toBe(t.key);
      }
    }
  });
});
