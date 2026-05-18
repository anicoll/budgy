import { describe, expect, it } from "vitest";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "../types";
import { suggestCategoryForPayee } from "./suggest-category";

function makeTxn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "t1",
    accountId: "acc1",
    date: "2026-01-01",
    amount: 1000 as never,
    type: "debit",
    categoryId: null,
    tags: [],
    cleared: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeCat(overrides: Partial<Category> = {}): Category {
  return {
    id: "c1",
    name: "Groceries",
    type: "expense",
    parentId: null,
    color: "#000",
    archived: false,
    sortOrder: 0,
    ...overrides,
  };
}

describe("suggestCategoryForPayee", () => {
  it("returns undefined when txn has no payee", () => {
    const txn = makeTxn({ id: "t1" });
    expect(suggestCategoryForPayee(txn, [txn], [])).toBeUndefined();
  });

  it("returns undefined when no other txns match the payee", () => {
    const txn = makeTxn({ id: "t1", payee: "Coles" });
    expect(suggestCategoryForPayee(txn, [txn], [])).toBeUndefined();
  });

  it("returns the category for a single matching txn", () => {
    const cat = makeCat({ id: "c1" });
    const txn = makeTxn({ id: "t1", payee: "Coles" });
    const other = makeTxn({ id: "t2", payee: "Coles", categoryId: "c1" });
    expect(suggestCategoryForPayee(txn, [txn, other], [cat])).toEqual(cat);
  });

  it("breaks ties by frequency — most common category wins", () => {
    const cat1 = makeCat({ id: "c1", name: "Groceries" });
    const cat2 = makeCat({ id: "c2", name: "Dining" });
    const txn = makeTxn({ id: "t1", payee: "Coles" });
    const others = [
      makeTxn({ id: "t2", payee: "Coles", categoryId: "c1" }),
      makeTxn({ id: "t3", payee: "Coles", categoryId: "c1" }),
      makeTxn({ id: "t4", payee: "Coles", categoryId: "c2" }),
    ];
    expect(suggestCategoryForPayee(txn, [txn, ...others], [cat1, cat2])).toEqual(cat1);
  });

  it("matches payee case-insensitively", () => {
    const cat = makeCat({ id: "c1" });
    const txn = makeTxn({ id: "t1", payee: "COLES" });
    const other = makeTxn({ id: "t2", payee: "coles", categoryId: "c1" });
    expect(suggestCategoryForPayee(txn, [txn, other], [cat])).toEqual(cat);
  });

  it("ignores the txn itself even if it has a categoryId", () => {
    const cat = makeCat({ id: "c1" });
    const txn = makeTxn({ id: "t1", payee: "Coles", categoryId: "c1" });
    expect(suggestCategoryForPayee(txn, [txn], [cat])).toBeUndefined();
  });

  it("returns undefined when the referenced category no longer exists", () => {
    const txn = makeTxn({ id: "t1", payee: "Coles" });
    const other = makeTxn({ id: "t2", payee: "Coles", categoryId: "deleted-cat" });
    expect(suggestCategoryForPayee(txn, [txn, other], [])).toBeUndefined();
  });
});
