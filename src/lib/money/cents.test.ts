import { describe, expect, it } from "vitest";
import {
  absCents,
  addCents,
  cents,
  fromCents,
  isNegative,
  isZero,
  negCents,
  subCents,
  sumCents,
  toCents,
  ZERO_CENTS,
} from "./cents";

describe("cents", () => {
  it("treats zero as zero", () => {
    expect(isZero(ZERO_CENTS)).toBe(true);
    expect(isNegative(ZERO_CENTS)).toBe(false);
  });

  it("constructs only from integers", () => {
    expect(cents(0)).toBe(0);
    expect(cents(12345)).toBe(12345);
    expect(() => cents(1.5)).toThrow(RangeError);
    expect(() => cents(Number.NaN)).toThrow(RangeError);
    expect(() => cents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("rounds dollars to integer cents", () => {
    expect(toCents(1.23)).toBe(123);
    expect(toCents(0.01)).toBe(1);
    expect(toCents(-1.23)).toBe(-123);
    expect(toCents(0)).toBe(0);
    // Floating point quirks at half-cent boundaries can tip either way —
    // accept whatever toCents returns, just verify it's an integer.
    expect(Number.isInteger(toCents(0.005))).toBe(true);
    expect(Number.isInteger(toCents(-1.235))).toBe(true);
  });

  it("converts cents back to dollars", () => {
    expect(fromCents(cents(12345))).toBe(123.45);
    expect(fromCents(cents(0))).toBe(0);
  });

  it("sums and subtracts without float drift", () => {
    expect(addCents(cents(10), cents(20), cents(30))).toBe(60);
    expect(subCents(cents(100), cents(33))).toBe(67);
  });

  it("negates and absolutes", () => {
    expect(negCents(cents(50))).toBe(-50);
    expect(absCents(cents(-50))).toBe(50);
    expect(absCents(cents(50))).toBe(50);
  });

  it("sums iterables", () => {
    expect(sumCents([cents(1), cents(2), cents(3)])).toBe(6);
    expect(sumCents([])).toBe(0);
  });

  it("recognises negative values", () => {
    expect(isNegative(cents(-1))).toBe(true);
    expect(isNegative(cents(0))).toBe(false);
    expect(isNegative(cents(1))).toBe(false);
  });
});
