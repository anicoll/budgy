import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/transactions/types";
import { cents } from "@/lib/money/cents";
import type { CategoryTarget } from "../types";
import { computeForecast } from "./forecast";

const TARGET: CategoryTarget = {
  categoryId: "cat-rates",
  amount: cents(120_000), // $1,200
  frequency: "quarterly",
  mode: "envelope",
  openedAt: "2024-01-01",
};

function txn(id: string, date: string, amount: number, categoryId = "cat-rates"): Transaction {
  return {
    id,
    accountId: "acc1",
    date,
    type: "debit",
    amount: cents(amount),
    categoryId,
    payee: "Council",
    cleared: true,
    createdAt: "",
    updatedAt: "",
  };
}

describe("computeForecast", () => {
  it("uses median spacing when ≥2 regular historical bills exist", () => {
    const txns = [
      txn("a", "2024-04-01", 120_000),
      txn("b", "2024-07-01", 120_000),
      txn("c", "2024-10-01", 120_000),
    ];
    const result = computeForecast(TARGET, txns, cents(50_000), "2024-11-15");
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("high");
    // Spacings: 91 + 92 = median ~91.5 → 92; last + 92 = 2025-01-01
    expect(result?.nextDueOn).toBe("2025-01-01");
  });

  it("falls back to openedAt + frequency when no history exists", () => {
    const result = computeForecast(TARGET, [], cents(30_000), "2024-02-15");
    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("low");
    // Cycle 1 ends at openedAt + 91 days = 2024-04-01
    expect(result?.nextDueOn).toBe("2024-04-01");
  });

  it("falls back with confidence=low when only one significant historical bill exists", () => {
    const txns = [txn("a", "2024-04-01", 120_000)];
    const result = computeForecast(TARGET, txns, cents(30_000), "2024-05-01");
    expect(result?.confidence).toBe("low");
  });

  it("ignores transactions below the significance threshold (50% of target)", () => {
    const txns = [
      txn("a", "2024-02-01", 5_000), // $50 — way below $600 threshold
      txn("b", "2024-03-01", 4_000),
      txn("c", "2024-04-01", 6_000),
    ];
    const result = computeForecast(TARGET, txns, cents(30_000), "2024-05-01");
    expect(result?.confidence).toBe("low"); // history ignored
  });

  it("ignores credit transactions in the same category", () => {
    const credits: Transaction[] = [
      {
        id: "r1",
        accountId: "acc1",
        date: "2024-04-01",
        type: "credit",
        amount: cents(120_000),
        categoryId: "cat-rates",
        payee: "Refund",
        cleared: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "r2",
        accountId: "acc1",
        date: "2024-07-01",
        type: "credit",
        amount: cents(120_000),
        categoryId: "cat-rates",
        payee: "Refund",
        cleared: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const result = computeForecast(TARGET, credits, cents(30_000), "2024-08-01");
    expect(result?.confidence).toBe("low");
  });

  it("ignores transactions for other categories", () => {
    const txns = [
      txn("a", "2024-04-01", 120_000, "cat-other"),
      txn("b", "2024-07-01", 120_000, "cat-other"),
    ];
    const result = computeForecast(TARGET, txns, cents(30_000), "2024-08-01");
    expect(result?.confidence).toBe("low");
  });

  it("falls back when spacing variance is too high (irregular)", () => {
    const txns = [
      txn("a", "2024-02-01", 120_000),
      txn("b", "2024-02-15", 120_000), // 14 days
      txn("c", "2024-08-01", 120_000), // 168 days
    ];
    const result = computeForecast(TARGET, txns, cents(30_000), "2024-09-01");
    expect(result?.confidence).toBe("low");
  });

  it("returns null when openedAt is in the future", () => {
    const future: CategoryTarget = { ...TARGET, openedAt: "2025-01-01" };
    const result = computeForecast(future, [], cents(0), "2024-01-01");
    expect(result).toBeNull();
  });

  it("projects fundedByNextDue = current balance + funding accrued between now and nextDueOn", () => {
    const result = computeForecast(TARGET, [], cents(60_000), "2024-02-15");
    expect(result).not.toBeNull();
    // openedAt 2024-01-01, fallback nextDue = 2024-04-01
    // days from 2024-02-15 to 2024-04-01 = 46
    // funded over those 46 days at 120_000 / 91 = ~60,659
    // balance projection ≈ 60,000 + 60,659 = ~120,659
    expect(result?.fundedByNextDue).toBeGreaterThan(cents(110_000));
    expect(result?.fundedByNextDue).toBeLessThan(cents(125_000));
  });

  it("bumps prediction forward by one period if it would be in the past", () => {
    // History stops 200 days ago — median predicts a date in the past
    const txns = [txn("a", "2024-01-01", 120_000), txn("b", "2024-04-01", 120_000)];
    const result = computeForecast(TARGET, txns, cents(30_000), "2024-12-01");
    expect(result?.nextDueOn >= "2024-12-01").toBe(true);
  });
});
