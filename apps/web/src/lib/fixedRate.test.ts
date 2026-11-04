import { compareFixedVsVariable } from "@budgy/engine";
import { describe, expect, it } from "vitest";
import {
  decodeFixed,
  defaultFixed,
  encodeFixed,
  type FixedForm,
  pathFor,
  presetSteps,
  toFixedInput,
} from "./fixedRate";

const FULL: FixedForm = {
  ...defaultFixed("2026-11-04"),
  frequency: "fortnightly",
  fortnightlyMethod: "true",
  extra: 150,
  offset: 25_000,
  path: "custom",
  customPath: [
    { months: 6, ratePct: 6.24 },
    { months: 18, ratePct: 5.74 },
  ],
  fixedYears: 2,
  fixedSharePct: 75,
  revertMarginPct: -0.25,
  breakAfterYears: 0.5,
  breakDropPct: 0.75,
};

describe("fixed or variable URL state", () => {
  it("round-trips every field", () => {
    expect(decodeFixed(encodeFixed(FULL))).toEqual(FULL);
  });

  it("round-trips the defaults", () => {
    const d = defaultFixed("2026-11-04");
    expect(decodeFixed(encodeFixed(d), defaultFixed("2020-01-01"))).toEqual(d);
  });

  it("falls back on a missing or unknown version", () => {
    const fb = defaultFixed("2026-11-04");
    expect(decodeFixed("", fb)).toBe(fb);
    expect(decodeFixed("v=99&b=1", fb)).toBe(fb);
  });

  it("drops broken custom steps and ignores negative amounts", () => {
    const f = decodeFixed("v=1&b=-5&p=c&cp=6:6.5,x:1,0:5,12:99,24:5.5", defaultFixed("2026-11-04"));
    expect(f.balance).toBe(600_000);
    expect(f.customPath).toEqual([
      { months: 6, ratePct: 6.5 },
      { months: 24, ratePct: 5.5 },
    ]);
  });
});

describe("rate paths in the form", () => {
  it("customising a preset keeps the same path", () => {
    const f = { ...defaultFixed("2026-11-04"), variableRatePct: 6 };
    const steps = presetSteps("rise-1", 6);
    expect(steps.at(-1)).toEqual({ months: 12, ratePct: 7 });
    expect(pathFor("custom", { ...f, customPath: steps })).toEqual(pathFor("rise-1", f));
  });

  it("feeds the engine", () => {
    const r = compareFixedVsVariable(toFixedInput(FULL));
    expect(r.fixedInput?.balance).toBe(45_000_000);
    expect(r.fixedEndDate).toBe("2028-11-04");
  });
});
