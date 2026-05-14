import type { Account } from "@/features/accounts/types";
import type { Budget } from "@/features/budgets/types";
import type { Category } from "@/features/categories/types";
import type { MortgagePlan } from "@/features/mortgage/types";
import type { SuperPlan, SuperSettings } from "@/features/super/types";
import type { Transaction } from "@/features/transactions/types";
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

let registry: Repositories | null = null;

export function getRepositories(): Repositories {
  if (!registry) {
    registry = {
      accounts: new LocalRepository<Account>(() => getDB().accounts),
      categories: new LocalRepository<Category>(() => getDB().categories),
      transactions: new LocalRepository<Transaction>(() => getDB().transactions),
      budgets: new LocalRepository<Budget>(() => getDB().budgets),
      superPlans: new LocalRepository<SuperPlan>(() => getDB().superPlans),
      superSettings: new LocalRepository<SuperSettings>(() => getDB().superSettings),
      mortgagePlans: new LocalRepository<MortgagePlan>(() => getDB().mortgagePlans),
    };
  }
  return registry;
}

export function resetRepositoriesForTests(): void {
  registry = null;
}
