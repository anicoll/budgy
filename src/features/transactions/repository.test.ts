import { beforeEach, describe, expect, it } from "vitest";
import { createAccount } from "@/features/accounts/repository";
import { isoDateAU } from "@/lib/date/au-locale";
import { resetRepositoriesForTests } from "@/lib/storage";
import { resetDBForTests } from "@/lib/storage/db";
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  recomputeAccountBalance,
  toggleCleared,
  updateTransaction,
} from "./repository";

const TODAY = isoDateAU();

async function seedAccount(name: string, opening = 0) {
  return createAccount({ name, type: "checking", openingBalance: opening, color: "#7c5cff" });
}

beforeEach(async () => {
  resetRepositoriesForTests();
  resetDBForTests();
  const { getDB } = await import("@/lib/storage/db");
  await getDB().delete();
  resetDBForTests();
});

describe("transactions repository", () => {
  it("creates a debit and updates account balance", async () => {
    const acc = await seedAccount("Checking", 100_00);
    await createTransaction({
      date: TODAY,
      type: "debit",
      accountId: acc.id,
      amount: 50_00,
      categoryId: null,
      payee: "Coles",
      tags: [],
      cleared: false,
    });

    const balance = await recomputeAccountBalance(acc.id);
    expect(balance).toBe(50_00);
  });

  it("creates a credit and updates account balance", async () => {
    const acc = await seedAccount("Savings", 0);
    await createTransaction({
      date: TODAY,
      type: "credit",
      accountId: acc.id,
      amount: 300_00,
      categoryId: null,
      payee: "Employer",
      tags: [],
      cleared: false,
    });

    const balance = await recomputeAccountBalance(acc.id);
    expect(balance).toBe(300_00);
  });

  it("creates a transfer and pairs two transactions", async () => {
    const from = await seedAccount("Everyday", 1000_00);
    const to = await seedAccount("Savings", 0);

    const [source, dest] = await createTransaction({
      date: TODAY,
      type: "transfer",
      accountId: from.id,
      amount: 200_00,
      transferAccountId: to.id,
      categoryId: null,
      tags: [],
      cleared: false,
    });

    expect(source.transferDirection).toBe("out");
    expect(dest.transferDirection).toBe("in");
    expect(source.transferPairId).toBe(dest.id);
    expect(dest.transferPairId).toBe(source.id);

    // Both accounts are updated
    expect(await recomputeAccountBalance(from.id)).toBe(800_00);
    expect(await recomputeAccountBalance(to.id)).toBe(200_00);
  });

  it("deleting a transfer removes the paired leg and recomputes both balances", async () => {
    const from = await seedAccount("A", 500_00);
    const to = await seedAccount("B", 100_00);

    const [source] = await createTransaction({
      date: TODAY,
      type: "transfer",
      accountId: from.id,
      amount: 100_00,
      transferAccountId: to.id,
      categoryId: null,
      tags: [],
      cleared: false,
    });

    await deleteTransaction(source.id);
    const all = await listTransactions();
    expect(all).toHaveLength(0);

    expect(await recomputeAccountBalance(from.id)).toBe(500_00);
    expect(await recomputeAccountBalance(to.id)).toBe(100_00);
  });

  it("toggleCleared flips the cleared flag", async () => {
    const acc = await seedAccount("Acc", 0);
    const [txn] = await createTransaction({
      date: TODAY,
      type: "credit",
      accountId: acc.id,
      amount: 10_00,
      categoryId: null,
      tags: [],
      cleared: false,
    });
    expect(txn.cleared).toBe(false);
    const toggled = await toggleCleared(txn.id);
    expect(toggled.cleared).toBe(true);
  });

  it("updateTransaction (non-transfer) reflects in balance", async () => {
    const acc = await seedAccount("Check", 200_00);
    const [txn] = await createTransaction({
      date: TODAY,
      type: "debit",
      accountId: acc.id,
      amount: 50_00,
      categoryId: null,
      tags: [],
      cleared: false,
    });
    // balance should be 150
    expect(await recomputeAccountBalance(acc.id)).toBe(150_00);

    await updateTransaction(txn.id, {
      date: TODAY,
      type: "debit",
      accountId: acc.id,
      amount: 100_00,
      categoryId: null,
      tags: [],
      cleared: false,
    });
    expect(await recomputeAccountBalance(acc.id)).toBe(100_00);
  });
});
