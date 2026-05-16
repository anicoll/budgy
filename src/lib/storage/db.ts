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
    this.version(1).stores({
      accounts: "&id, type, sortOrder, archived",
      categories: "&id, parentId, type, archived, sortOrder",
      transactions: "&id, accountId, categoryId, date, [accountId+date], cleared",
      budgets: "&id, period, active, startDate",
      superPlans: "&id, updatedAt",
      mortgagePlans: "&id, updatedAt",
    });
    // v2: adds superSettings table; migrates shared fields out of the single superPlan
    this.version(2)
      .stores({ superSettings: "&id, updatedAt" })
      .upgrade(async (tx) => {
        const existing = await tx.table("superPlans").get("primary");
        await tx.table("superSettings").put({
          id: "primary",
          inflationPct: (existing as Record<string, unknown>)?.inflationPct ?? 0.025,
          currentAge: (existing as Record<string, unknown>)?.currentAge ?? 35,
          retirementAge: (existing as Record<string, unknown>)?.retirementAge ?? 67,
          annualSalary: (existing as Record<string, unknown>)?.annualSalary ?? 10_000_000,
          employerContributionPct:
            (existing as Record<string, unknown>)?.employerContributionPct ?? 0.12,
          activePlanId: existing ? "primary" : null,
          updatedAt: new Date().toISOString(),
        });
        if (existing) {
          const {
            inflationPct: _i,
            currentAge: _a,
            retirementAge: _r,
            annualSalary: _s,
            employerContributionPct: _e,
            ...rest
          } = existing as Record<string, unknown>;
          await tx.table("superPlans").put({ ...rest, name: "My Super" });
        }
      });
    // v3: remove annualSalary from superSettings (now read from prefs store)
    this.version(3).upgrade(async (tx) => {
      await tx
        .table("superSettings")
        .toCollection()
        .modify((record: Record<string, unknown>) => {
          delete record.annualSalary;
        });
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
