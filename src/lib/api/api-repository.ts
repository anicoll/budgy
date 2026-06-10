import type { Account, AccountType } from "@/features/accounts/types";
import type { Budget } from "@/features/budgets/types";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import type { Cents } from "@/lib/money/cents";
import type { ListQuery, Repository } from "@/lib/storage/repository";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Go API response types
interface GoBudgetResponse {
  id: string;
  name: string;
  method: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

interface GoAccountResponse {
  id: string;
  budget_id: string;
  name: string;
  type: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

interface GoCategoryResponse {
  id: string;
  budget_id: string;
  name: string;
  budgeted: number;
  balance: number;
  target_limit: number;
  created_at: string;
  updated_at: string;
}

interface GoTransactionResponse {
  id: string;
  budget_id: string;
  account_id: string;
  category_id: string;
  amount: number;
  description: string;
  date: string;
  created_at: string;
  updated_at: string;
}

let activeBudgetIdCache: string | null = null;

export async function getActiveBudgetId(): Promise<string> {
  if (activeBudgetIdCache) return activeBudgetIdCache;
  try {
    const res = await fetch(`${API_BASE_URL}/api/budgets`);
    if (!res.ok) throw new Error("Failed to fetch budgets");
    const budgets = await res.json();
    if (budgets && budgets.length > 0) {
      activeBudgetIdCache = budgets[0].id;
      return budgets[0].id;
    }
  } catch (e) {
    console.error("Error fetching budgets, attempting to create default:", e);
  }

  // Create default budget if none exists
  const createRes = await fetch(`${API_BASE_URL}/api/budgets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Default Budget",
      method: "ZERO_SUM",
      currency: "AUD",
    }),
  });
  if (!createRes.ok) throw new Error("Failed to create default budget");
  const defaultBudget = await createRes.json();
  activeBudgetIdCache = defaultBudget.id;
  return defaultBudget.id;
}

export function clearActiveBudgetIdCache() {
  activeBudgetIdCache = null;
}

// -----------------------------------------------------------------------------
// ApiBudgetRepository
// -----------------------------------------------------------------------------
export class ApiBudgetRepository implements Repository<Budget> {
  async list(_query?: ListQuery<Budget>): Promise<Budget[]> {
    const res = await fetch(`${API_BASE_URL}/api/budgets`);
    if (!res.ok) throw new Error("Failed to fetch budgets from API");
    const goBudgets = await res.json();
    if (!goBudgets) return [];

    // Map each budget
    const budgets: Budget[] = [];
    for (const b of goBudgets as GoBudgetResponse[]) {
      // Fetch categories for this budget to build targets
      let targets: Budget["targets"] = [];
      try {
        const catRes = await fetch(`${API_BASE_URL}/api/budgets/${b.id}/categories`);
        if (catRes.ok) {
          const goCats = await catRes.json();
          if (goCats) {
            targets = (goCats as GoCategoryResponse[])
              .filter((c) => c.target_limit > 0)
              .map((c) => ({
                categoryId: c.id,
                amount: c.target_limit as Cents,
                frequency: "monthly",
                mode: "envelope",
                openedAt: b.created_at
                  ? b.created_at.substring(0, 10)
                  : new Date().toISOString().substring(0, 10),
              }));
          }
        }
      } catch (e) {
        console.error(`Error fetching categories for budget ${b.id}:`, e);
      }

      budgets.push({
        id: b.id,
        name: b.name,
        period: "monthly",
        startDate: b.created_at
          ? b.created_at.substring(0, 10)
          : new Date().toISOString().substring(0, 10),
        targets,
        active: true, // Mark active so the first one matches getActiveBudget
        createdAt: b.created_at || new Date().toISOString(),
        updatedAt: b.updated_at || new Date().toISOString(),
      });
    }
    return budgets;
  }

  async get(id: string): Promise<Budget | null> {
    const res = await fetch(`${API_BASE_URL}/api/budgets/${id}`);
    if (!res.ok) return null;
    const b = (await res.json()) as GoBudgetResponse;

    // Fetch categories for this budget to build targets
    let targets: Budget["targets"] = [];
    try {
      const catRes = await fetch(`${API_BASE_URL}/api/budgets/${b.id}/categories`);
      if (catRes.ok) {
        const goCats = await catRes.json();
        if (goCats) {
          targets = (goCats as GoCategoryResponse[])
            .filter((c) => c.target_limit > 0)
            .map((c) => ({
              categoryId: c.id,
              amount: c.target_limit as Cents,
              frequency: "monthly",
              mode: "envelope",
              openedAt: b.created_at
                ? b.created_at.substring(0, 10)
                : new Date().toISOString().substring(0, 10),
            }));
        }
      }
    } catch (e) {
      console.error(`Error fetching categories for budget ${b.id}:`, e);
    }

    return {
      id: b.id,
      name: b.name,
      period: "monthly",
      startDate: b.created_at
        ? b.created_at.substring(0, 10)
        : new Date().toISOString().substring(0, 10),
      targets,
      active: true,
      createdAt: b.created_at || new Date().toISOString(),
      updatedAt: b.updated_at || new Date().toISOString(),
    };
  }

  async upsert(entity: Budget): Promise<Budget> {
    // Check if it already exists to avoid unique constraint error on backend
    const existing = await this.get(entity.id);
    if (existing) return existing;

    const hasEnvelope = entity.targets?.some((t) => t.mode === "envelope");
    const res = await fetch(`${API_BASE_URL}/api/budgets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: entity.name,
        method: hasEnvelope ? "ENVELOPE" : "ZERO_SUM",
        currency: "AUD",
      }),
    });
    if (!res.ok) throw new Error("Failed to create budget via API");
    const b = await res.json();
    return {
      id: b.id,
      name: b.name,
      period: "monthly",
      startDate: b.created_at
        ? b.created_at.substring(0, 10)
        : new Date().toISOString().substring(0, 10),
      targets: entity.targets || [],
      active: true,
      createdAt: b.created_at || new Date().toISOString(),
      updatedAt: b.updated_at || new Date().toISOString(),
    };
  }

  async bulkUpsert(entities: Budget[]): Promise<Budget[]> {
    const results: Budget[] = [];
    for (const entity of entities) {
      results.push(await this.upsert(entity));
    }
    return results;
  }

  async delete(_id: string): Promise<void> {
    // Budget delete is not supported in the current Go backend API
  }

  async count(_query?: ListQuery<Budget>): Promise<number> {
    const budgets = await this.list();
    return budgets.length;
  }
}

// -----------------------------------------------------------------------------
// ApiAccountRepository
// -----------------------------------------------------------------------------
function mapGoTypeToFrontend(type: string): AccountType {
  switch (type) {
    case "CHECKING":
      return "checking";
    case "SAVINGS":
      return "savings";
    case "CREDIT_CARD":
      return "credit";
    case "CASH":
      return "cash";
    default:
      return "checking";
  }
}

function mapFrontendTypeToGo(type: AccountType): string {
  switch (type) {
    case "checking":
      return "CHECKING";
    case "savings":
      return "SAVINGS";
    case "credit":
      return "CREDIT_CARD";
    case "cash":
      return "CASH";
    default:
      return "CHECKING";
  }
}

export class ApiAccountRepository implements Repository<Account> {
  async list(_query?: ListQuery<Account>): Promise<Account[]> {
    const budgetId = await getActiveBudgetId();
    const res = await fetch(`${API_BASE_URL}/api/budgets/${budgetId}/accounts`);
    if (!res.ok) throw new Error("Failed to fetch accounts from API");
    const goAccounts = await res.json();
    if (!goAccounts) return [];

    return (goAccounts as GoAccountResponse[]).map((a) => ({
      id: a.id,
      name: a.name,
      type: mapGoTypeToFrontend(a.type),
      openingBalance: a.balance as Cents,
      currentBalance: a.balance as Cents,
      currency: "AUD",
      color: "#7c5cff",
      archived: false,
      sortOrder: 0,
      createdAt: a.created_at || new Date().toISOString(),
      updatedAt: a.updated_at || new Date().toISOString(),
    }));
  }

  async get(id: string): Promise<Account | null> {
    const accounts = await this.list();
    return accounts.find((a) => a.id === id) || null;
  }

  async upsert(entity: Account): Promise<Account> {
    const existing = await this.get(entity.id);
    if (existing) return existing;

    const budgetId = await getActiveBudgetId();
    const res = await fetch(`${API_BASE_URL}/api/budgets/${budgetId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: entity.name,
        type: mapFrontendTypeToGo(entity.type),
        balance: entity.openingBalance,
      }),
    });
    if (!res.ok) throw new Error("Failed to create account via API");
    const a = await res.json();
    return {
      id: a.id,
      name: a.name,
      type: mapGoTypeToFrontend(a.type),
      openingBalance: a.balance as Cents,
      currentBalance: a.balance as Cents,
      currency: "AUD",
      color: entity.color || "#7c5cff",
      archived: false,
      sortOrder: entity.sortOrder || 0,
      createdAt: a.created_at || new Date().toISOString(),
      updatedAt: a.updated_at || new Date().toISOString(),
    };
  }

  async bulkUpsert(entities: Account[]): Promise<Account[]> {
    const results: Account[] = [];
    for (const entity of entities) {
      results.push(await this.upsert(entity));
    }
    return results;
  }

  async delete(_id: string): Promise<void> {
    // Delete account is not supported in the current Go backend API
  }

  async count(_query?: ListQuery<Account>): Promise<number> {
    const list = await this.list();
    return list.length;
  }
}

// -----------------------------------------------------------------------------
// ApiCategoryRepository
// -----------------------------------------------------------------------------
export class ApiCategoryRepository implements Repository<Category> {
  async list(_query?: ListQuery<Category>): Promise<Category[]> {
    const budgetId = await getActiveBudgetId();
    const res = await fetch(`${API_BASE_URL}/api/budgets/${budgetId}/categories`);
    if (!res.ok) throw new Error("Failed to fetch categories from API");
    const goCats = await res.json();
    if (!goCats) return [];

    return (goCats as GoCategoryResponse[]).map((c) => ({
      id: c.id,
      name: c.name,
      parentId: null,
      type: "expense",
      color: "#7c5cff",
      archived: false,
      sortOrder: 0,
      system: false,
    }));
  }

  async get(id: string): Promise<Category | null> {
    const list = await this.list();
    return list.find((c) => c.id === id) || null;
  }

  async upsert(entity: Category): Promise<Category> {
    const existing = await this.get(entity.id);
    if (existing) return existing;

    const budgetId = await getActiveBudgetId();
    const res = await fetch(`${API_BASE_URL}/api/budgets/${budgetId}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: entity.name,
        target_limit: 0,
      }),
    });
    if (!res.ok) throw new Error("Failed to create category via API");
    const c = await res.json();
    return {
      id: c.id,
      name: c.name,
      parentId: null,
      type: "expense",
      color: entity.color || "#7c5cff",
      archived: false,
      sortOrder: entity.sortOrder || 0,
      system: entity.system || false,
    };
  }

  async bulkUpsert(entities: Category[]): Promise<Category[]> {
    const results: Category[] = [];
    for (const entity of entities) {
      results.push(await this.upsert(entity));
    }
    return results;
  }

  async delete(_id: string): Promise<void> {
    // Delete category is not supported in the current Go backend API
  }

  async count(_query?: ListQuery<Category>): Promise<number> {
    const list = await this.list();
    return list.length;
  }
}

// -----------------------------------------------------------------------------
// ApiTransactionRepository
// -----------------------------------------------------------------------------
export class ApiTransactionRepository implements Repository<Transaction> {
  async list(_query?: ListQuery<Transaction>): Promise<Transaction[]> {
    const budgetId = await getActiveBudgetId();
    const res = await fetch(`${API_BASE_URL}/api/budgets/${budgetId}/transactions`);
    if (!res.ok) throw new Error("Failed to fetch transactions from API");
    const goTxns = await res.json();
    if (!goTxns) return [];

    return (goTxns as GoTransactionResponse[]).map((t) => ({
      id: t.id,
      accountId: t.account_id,
      date: t.date,
      amount: t.amount as Cents,
      type: t.amount > 0 ? "credit" : "debit",
      categoryId: t.category_id || null,
      payee: t.description,
      tags: [],
      cleared: true,
      createdAt: t.created_at || new Date().toISOString(),
      updatedAt: t.updated_at || new Date().toISOString(),
    }));
  }

  async get(id: string): Promise<Transaction | null> {
    const list = await this.list();
    return list.find((t) => t.id === id) || null;
  }

  async upsert(entity: Transaction): Promise<Transaction> {
    const existing = await this.get(entity.id);
    if (existing) return existing;

    const budgetId = await getActiveBudgetId();
    const res = await fetch(`${API_BASE_URL}/api/budgets/${budgetId}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: entity.accountId,
        category_id: entity.categoryId || "",
        amount: entity.amount,
        description: entity.payee || "Transaction",
        date: entity.date,
      }),
    });
    if (!res.ok) throw new Error("Failed to create transaction via API");
    const t = await res.json();
    return {
      id: t.id,
      accountId: t.account_id,
      date: t.date,
      amount: t.amount as Cents,
      type: t.amount > 0 ? "credit" : "debit",
      categoryId: t.category_id || null,
      payee: t.description,
      tags: [],
      cleared: true,
      createdAt: t.created_at || new Date().toISOString(),
      updatedAt: t.updated_at || new Date().toISOString(),
    };
  }

  async bulkUpsert(entities: Transaction[]): Promise<Transaction[]> {
    const results: Transaction[] = [];
    for (const entity of entities) {
      results.push(await this.upsert(entity));
    }
    return results;
  }

  async delete(_id: string): Promise<void> {
    // Delete transaction is not supported in the current Go backend API
  }

  async count(_query?: ListQuery<Transaction>): Promise<number> {
    const list = await this.list();
    return list.length;
  }
}
