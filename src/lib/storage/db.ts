import Dexie, { type Table } from "dexie";
import type { Account } from "@/features/accounts/types";
import type { Budget } from "@/features/budgets/types";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";

export interface SuperPlanRow {
  id: string;
  data: unknown;
  updatedAt: string;
}

export interface MortgagePlanRow {
  id: string;
  data: unknown;
  updatedAt: string;
}

export class BudgyDB extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  superPlans!: Table<SuperPlanRow, string>;
  mortgagePlans!: Table<MortgagePlanRow, string>;

  constructor() {
    super("budgy");
    this.version(1).stores({
      accounts: "&id, type, sortOrder, archived",
      categories: "&id, parentId, type, archived, sortOrder",
      transactions: "&id, accountId, categoryId, date, [accountId+date], cleared",
      budgets: "&id, period, active, startDate",
      superPlans: "&id, updatedAt",
      mortgagePlans: "&id, updatedAt",
    });
  }
}

let dbInstance: BudgyDB | null = null;

export function getDB(): BudgyDB {
  if (typeof window === "undefined") {
    throw new Error("BudgyDB is browser-only (uses IndexedDB)");
  }
  if (!dbInstance) {
    dbInstance = new BudgyDB();
  }
  return dbInstance;
}

export function resetDBForTests(): void {
  dbInstance = null;
}
