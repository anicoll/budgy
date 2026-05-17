import Dexie, { type Table } from "dexie";
import type { Account } from "@/features/accounts/types";
import type { Budget } from "@/features/budgets/types";
import type { Category } from "@/features/categories/types";
import type { MortgagePlan } from "@/features/mortgage/types";
import type { SuperPlan, SuperSettings } from "@/features/super/types";
import type { Transaction } from "@/features/transactions/types";

export class BudgyDB extends Dexie {
  accounts!: Table<Account, string>;
  categories!: Table<Category, string>;
  transactions!: Table<Transaction, string>;
  budgets!: Table<Budget, string>;
  superPlans!: Table<SuperPlan, string>;
  superSettings!: Table<SuperSettings, string>;
  mortgagePlans!: Table<MortgagePlan, string>;

  constructor() {
    super("budgy");
    this.version(4).stores({
      accounts: "&id, type, sortOrder, archived",
      categories: "&id, parentId, type, archived, sortOrder",
      transactions: "&id, accountId, categoryId, date, [accountId+date], cleared",
      budgets: "&id, period, active, startDate",
      superPlans: "&id, updatedAt",
      superSettings: "&id, updatedAt",
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
