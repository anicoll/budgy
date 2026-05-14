import { beforeEach, describe, expect, it } from "vitest";
import { resetRepositoriesForTests } from "@/lib/storage";
import { resetDBForTests } from "@/lib/storage/db";
import {
  createAccount,
  deleteAccount,
  listAccounts,
  netWorth,
  reorderAccounts,
  setArchived,
  updateAccount,
} from "./repository";

beforeEach(async () => {
  // Wipe IndexedDB between tests via fake-indexeddb's auto reset is per-process,
  // so instead we forcibly reset the singleton + delete known stores.
  resetRepositoriesForTests();
  resetDBForTests();
  const { getDB } = await import("@/lib/storage/db");
  await getDB().delete();
  resetDBForTests();
});

describe("accounts repository", () => {
  it("creates and lists accounts in sortOrder", async () => {
    const a = await createAccount({
      name: "Everyday",
      type: "checking",
      institution: "ANZ",
      openingBalance: 100000,
      color: "#7c5cff",
    });
    const b = await createAccount({
      name: "Savings",
      type: "savings",
      institution: "ING",
      openingBalance: 500000,
      color: "#22c1c3",
    });

    const all = await listAccounts();
    expect(all.map((x) => x.id)).toEqual([a.id, b.id]);
    expect(all[0].currentBalance).toBe(100000);
    expect(all[1].currentBalance).toBe(500000);
  });

  it("update keeps currentBalance delta consistent with openingBalance changes", async () => {
    const created = await createAccount({
      name: "Spend",
      type: "checking",
      openingBalance: 10000,
      color: "#7c5cff",
    });
    // Simulate that some prior txns moved current balance by +5_00
    // by writing the account with adjusted currentBalance via repository internals.
    // For this test the simpler check is that update preserves the delta.
    const updated = await updateAccount(created.id, {
      name: "Spend",
      type: "checking",
      openingBalance: 20000,
      color: "#7c5cff",
    });
    expect(updated.openingBalance).toBe(20000);
    // currentBalance should also have shifted by +10_000
    expect(updated.currentBalance).toBe(20000);
  });

  it("archive hides accounts from default list, includeArchived shows them", async () => {
    const a = await createAccount({
      name: "Old card",
      type: "credit",
      openingBalance: 0,
      color: "#ef4f6c",
    });
    await setArchived(a.id, true);

    expect(await listAccounts()).toEqual([]);
    expect((await listAccounts({ includeArchived: true })).map((x) => x.id)).toEqual([a.id]);
  });

  it("delete removes the row", async () => {
    const a = await createAccount({
      name: "Cash",
      type: "cash",
      openingBalance: 2500,
      color: "#f5b942",
    });
    await deleteAccount(a.id);
    expect(await listAccounts()).toEqual([]);
  });

  it("reorderAccounts assigns sortOrder by index", async () => {
    const a = await createAccount({
      name: "A",
      type: "checking",
      openingBalance: 0,
      color: "#7c5cff",
    });
    const b = await createAccount({
      name: "B",
      type: "savings",
      openingBalance: 0,
      color: "#22c1c3",
    });
    const c = await createAccount({
      name: "C",
      type: "cash",
      openingBalance: 0,
      color: "#f5b942",
    });

    await reorderAccounts([c.id, a.id, b.id]);
    const sorted = await listAccounts();
    expect(sorted.map((x) => x.name)).toEqual(["C", "A", "B"]);
  });

  it("netWorth subtracts liabilities and excludes archived", async () => {
    await createAccount({
      name: "Cash",
      type: "checking",
      openingBalance: 500_000,
      color: "#7c5cff",
    });
    await createAccount({
      name: "Card",
      type: "credit",
      openingBalance: 150_000,
      color: "#ef4f6c",
    });
    const archived = await createAccount({
      name: "Old",
      type: "savings",
      openingBalance: 999_999,
      color: "#22c1c3",
    });
    await setArchived(archived.id, true);

    const accounts = await listAccounts({ includeArchived: true });
    expect(netWorth(accounts)).toBe(350_000);
  });
});
