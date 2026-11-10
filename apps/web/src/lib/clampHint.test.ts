import { describe, expect, it } from "vitest";
import { clampWithHint } from "./clampHint";

describe("clampWithHint", () => {
  it("leaves in-range values alone", () => {
    expect(clampWithHint(20, 1, 40, "yrs")).toEqual({ value: 20, hint: null });
    expect(clampWithHint(40, 1, 40, "yrs").hint).toBeNull();
  });
  it("caps and says so", () => {
    expect(clampWithHint(45, 1, 40, "yrs")).toEqual({
      value: 40,
      hint: "Capped at 40 years, the most this tool handles.",
    });
  });
  it("raises to the minimum", () => {
    expect(clampWithHint(0, 1, 40, "yrs")).toEqual({
      value: 1,
      hint: "Raised to 1 year, the least this tool handles.",
    });
  });
  it("handles percent, money and no suffix", () => {
    expect(clampWithHint(99, 0, 20, "%").hint).toBe("Capped at 20%, the most this tool handles.");
    expect(clampWithHint(9, 0, 5).hint).toBe("Capped at 5, the most this tool handles.");
    expect(clampWithHint(9e9, 0, 5e6, undefined, (n) => `$${n.toLocaleString("en-AU")}`).hint).toBe(
      "Capped at $5,000,000, the most this tool handles.",
    );
  });
});
