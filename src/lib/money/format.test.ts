import { describe, expect, it } from "vitest";
import { cents } from "./cents";
import { formatAUD, formatAUDCompact, formatPercent, formatSigned, parseAUDInput } from "./format";

describe("format AUD", () => {
  it("formats positive amounts with the AUD symbol", () => {
    expect(formatAUD(cents(123456))).toBe("$1,234.56");
    expect(formatAUD(cents(0))).toBe("$0.00");
  });

  it("formats negative amounts with leading minus", () => {
    expect(formatAUD(cents(-123456))).toBe("-$1,234.56");
  });

  it("compact form drops trailing zeros and uses k/M", () => {
    const out = formatAUDCompact(cents(1_234_500));
    expect(out).toMatch(/12.*K|12.*k/);
  });

  it("formatSigned prefixes plus on positive", () => {
    expect(formatSigned(cents(100))).toBe("+$1.00");
    expect(formatSigned(cents(0))).toBe("$0.00");
    expect(formatSigned(cents(-100))).toBe("-$1.00");
  });

  it("formatPercent prints a percent", () => {
    expect(formatPercent(0.05)).toMatch(/5/);
  });
});

describe("parseAUDInput", () => {
  it("accepts plain numbers and dollar signs", () => {
    expect(parseAUDInput("1234.56")).toBe(123456);
    expect(parseAUDInput("$1,234.56")).toBe(123456);
    expect(parseAUDInput("  -50 ")).toBe(-5000);
  });

  it("returns null on empty or garbage", () => {
    expect(parseAUDInput("")).toBeNull();
    expect(parseAUDInput("nope")).toBeNull();
  });
});
