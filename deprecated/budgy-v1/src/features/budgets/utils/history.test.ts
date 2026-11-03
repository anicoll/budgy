import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/transactions/types";
import { cents } from "@/lib/money/cents";
import type { CategoryTarget } from "../types";
import { computeBalanceHistory } from "./history";

const TARGET: CategoryTarget = {
  categoryId: "cat-rates",
  amount: cents(120_000), // $1,200/quarter
  frequency: "quarterly",
  mode: "envelope",
  openedAt: "2024-01-01",
};

function debit(date: string, amount: number): Transaction {
  return {
    id: `t-${date}`,
    accountId: "acc1",
    date,
    type: "debit",
    amount: cents(amount),
    categoryId: "cat-rates",
    payee: "Council",
    cleared: true,
    createdAt: "",
    updatedAt: "",
    tags: [],
  };
}

describe("computeBalanceHistory", () => {
  it("returns the requested number of points, oldest first", () => {
    const points = computeBalanceHistory(TARGET, [], "2024-06-15", 6, "monthly");
    expect(points).toHaveLength(6);
    expect(points[0].periodStart < points[5].periodStart).toBe(true);
  });

  it("balance accumulates each month with no spend (saw-tooth fill)", () => {
    const points = computeBalanceHistory(TARGET, [], "2024-06-15", 6, "monthly");
    // Each point's balance should be ≥ the previous (monotonic without spend)
    for (let i = 1; i < points.length; i++) {
      expect(points[i].balance).toBeGreaterThanOrEqual(points[i - 1].balance);
    }
    // Last point ≈ ~166 days * (120_000 / 91) ≈ 218k, but eval clamps to nowISO
    expect(points[points.length - 1].balance).toBeGreaterThan(0);
  });

  it("balance drops after a significant bill lands", () => {
    const txns = [debit("2024-04-01", 120_000)];
    const points = computeBalanceHistory(TARGET, txns, "2024-06-15", 6, "monthly");
    // Find the March vs April points — April should be lower than March
    const march = points.find((p) => p.periodStart === "2024-03-01");
    const april = points.find((p) => p.periodStart === "2024-04-01");
    if (!march || !april) throw new Error("missing expected points");
    expect(april.balance).toBeLessThan(march.balance);
  });

  it("returns balance 0 for periods entirely before openedAt", () => {
    const points = computeBalanceHistory(TARGET, [], "2024-03-15", 6, "monthly");
    // Earliest periods are well before openedAt 2024-01-01 → balance 0
    const earliest = points[0];
    expect(earliest.balance).toBe(0);
  });

  it("ignores credit transactions (refunds) for spend calculation", () => {
    const txns: Transaction[] = [
      debit("2024-04-01", 60_000),
      {
        id: "refund",
        accountId: "acc1",
        date: "2024-04-05",
        type: "credit",
        amount: cents(60000),
        categoryId: "cat-rates",
        payee: "Council refund",
        cleared: true,
        createdAt: "",
        updatedAt: "",
        tags: [],
      },
    ];
    const pointsWithRefund = computeBalanceHistory(TARGET, txns, "2024-05-15", 4, "monthly");
    const pointsNoRefund = computeBalanceHistory(
      TARGET,
      [debit("2024-04-01", 60_000)],
      "2024-05-15",
      4,
      "monthly",
    );
    expect(pointsWithRefund[3].balance).toBe(pointsNoRefund[3].balance);
  });

  it("ignores transactions for other categories", () => {
    const txns: Transaction[] = [{ ...debit("2024-04-01", 60_000), categoryId: "cat-other" }];
    const points = computeBalanceHistory(TARGET, txns, "2024-05-15", 4, "monthly");
    const noTxnPoints = computeBalanceHistory(TARGET, [], "2024-05-15", 4, "monthly");
    expect(points[3].balance).toBe(noTxnPoints[3].balance);
  });
});
