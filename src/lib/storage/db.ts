import Dexie, { type Table } from "dexie";
import type { Account } from "@/features/accounts/types";

// Future entities — declared here so the schema is stable from v1 even
// before their feature code lands. Concrete shapes are owned by each feature.
export interface CategoryRow {
  id: string;
  name: string;
  parentId: string | null;
  type: "income" | "expense" | "transfer";
  icon?: string;
  color: string;
  archived: boolean;
  sortOrder: number;
}

export interface TransactionRow {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  type: "debit" | "credit" | "transfer";
  categoryId: string | null;
  payee?: string;
  description?: string;
  tags: string[];
  transferAccountId?: string;
  transferPairId?: string;
  cleared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetRow {
  id: string;
  name: string;
  period: "weekly" | "fortnightly" | "monthly" | "yearly";
  startDate: string;
  categoryAllocations: Array<{ categoryId: string; amount: number; rollover: boolean }>;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  categories!: Table<CategoryRow, string>;
  transactions!: Table<TransactionRow, string>;
  budgets!: Table<BudgetRow, string>;
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
