import type { Account } from "@/features/accounts/types";
import type { Budget } from "@/features/budgets/types";
import type { Category } from "@/features/categories/types";
import type { MortgagePlan } from "@/features/mortgage/types";
import type { SuperPlan, SuperSettings } from "@/features/super/types";
import type { Transaction } from "@/features/transactions/types";
import {
  ApiAccountRepository,
  ApiBudgetRepository,
  ApiCategoryRepository,
  ApiTransactionRepository,
} from "@/lib/api/api-repository";
import { getDB } from "./db";
import { LocalRepository } from "./local-repository";
import type { Repository } from "./repository";

export type { Entity, ListQuery, Repository } from "./repository";

export interface Repositories {
  accounts: Repository<Account>;
  categories: Repository<Category>;
  transactions: Repository<Transaction>;
  budgets: Repository<Budget>;
  superPlans: Repository<SuperPlan>;
  superSettings: Repository<SuperSettings>;
  mortgagePlans: Repository<MortgagePlan>;
}

let onlineRegistry: Repositories | null = null;
let offlineRegistry: Repositories | null = null;

export function getRepositories(): Repositories {
  const isTest =
    typeof process !== "undefined" && (process.env.NODE_ENV === "test" || process.env.VITEST);
  if (isTest) {
    if (!offlineRegistry) {
      offlineRegistry = {
        accounts: new LocalRepository<Account>(() => getDB().accounts),
        categories: new LocalRepository<Category>(() => getDB().categories),
        transactions: new LocalRepository<Transaction>(() => getDB().transactions),
        budgets: new LocalRepository<Budget>(() => getDB().budgets),
        superPlans: new LocalRepository<SuperPlan>(() => getDB().superPlans),
        superSettings: new LocalRepository<SuperSettings>(() => getDB().superSettings),
        mortgagePlans: new LocalRepository<MortgagePlan>(() => getDB().mortgagePlans),
      };
    }
    return offlineRegistry;
  }

  let mode: "offline" | "online" = "online";
  if (typeof window !== "undefined") {
    try {
      const { usePrefs } = require("@/lib/state/prefs-store");
      mode = usePrefs.getState().storageMode || "online";
    } catch (e) {
      console.warn("Failed to load prefs in getRepositories:", e);
    }
  }

  if (mode === "online") {
    if (!onlineRegistry) {
      onlineRegistry = {
        accounts: new ApiAccountRepository(),
        categories: new ApiCategoryRepository(),
        transactions: new ApiTransactionRepository(),
        budgets: new ApiBudgetRepository(),
        superPlans: new LocalRepository<SuperPlan>(() => getDB().superPlans),
        superSettings: new LocalRepository<SuperSettings>(() => getDB().superSettings),
        mortgagePlans: new LocalRepository<MortgagePlan>(() => getDB().mortgagePlans),
      };
    }
    return onlineRegistry;
  } else {
    if (!offlineRegistry) {
      offlineRegistry = {
        accounts: new LocalRepository<Account>(() => getDB().accounts),
        categories: new LocalRepository<Category>(() => getDB().categories),
        transactions: new LocalRepository<Transaction>(() => getDB().transactions),
        budgets: new LocalRepository<Budget>(() => getDB().budgets),
        superPlans: new LocalRepository<SuperPlan>(() => getDB().superPlans),
        superSettings: new LocalRepository<SuperSettings>(() => getDB().superSettings),
        mortgagePlans: new LocalRepository<MortgagePlan>(() => getDB().mortgagePlans),
      };
    }
    return offlineRegistry;
  }
}

export function resetRepositoriesForTests(): void {
  onlineRegistry = null;
  offlineRegistry = null;
}
