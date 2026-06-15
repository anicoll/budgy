import type { Timestamp } from "@bufbuild/protobuf/wkt";
import { ACCOUNT_DEFAULT_COLOR, type Account, type AccountType } from "@/features/accounts/types";
import type { Budget } from "@/features/budgets/types";
import type { Category } from "@/features/categories/types";
import type { Transaction } from "@/features/transactions/types";
import { AccountType as ProtoAccountType } from "@/gen/budgy/v1/account_pb";
import { BudgetMethod } from "@/gen/budgy/v1/budget_pb";
import {
  accountClient,
  budgetClient,
  categoryClient,
  transactionClient,
} from "@/lib/api/connect-client";
import type { Cents } from "@/lib/money/cents";
import type { ListQuery, Repository } from "@/lib/storage/repository";

// ─── Timestamp helpers ────────────────────────────────────────────────────────

function tsToISO(ts: Timestamp | null | undefined): string {
  if (!ts) return new Date().toISOString();
  const ms = Number(ts.seconds) * 1000 + Math.floor(ts.nanos / 1000000);
  return new Date(ms).toISOString();
}

function tsToDateStr(ts: Timestamp | null | undefined): string {
  return tsToISO(ts).substring(0, 10);
}

// ─── Active budget cache ───────────────────────────────────────────────────────

let activeBudgetIdCache: string | null = null;

export async function getActiveBudgetId(): Promise<string> {
  if (activeBudgetIdCache) return activeBudgetIdCache;
  try {
    const res = await budgetClient.listBudgets({});
    const budgets = res.budgets ?? [];
    if (budgets.length > 0) {
      activeBudgetIdCache = budgets[0].id;
      return budgets[0].id;
    }
  } catch (e) {
    console.error("Error fetching budgets, attempting to create default:", e);
  }
  // Create default budget if none exists
  const createRes = await budgetClient.createBudget({
    name: "Default Budget",
    method: BudgetMethod.ZERO_SUM,
    currency: "AUD",
  });
  if (!createRes.budget) throw new Error("Failed to create default budget");
  activeBudgetIdCache = createRes.budget.id;
  return createRes.budget.id;
}

export function clearActiveBudgetIdCache() {
  activeBudgetIdCache = null;
}

// ─── Type mappers ─────────────────────────────────────────────────────────────

function mapProtoTypeToFrontend(type: ProtoAccountType): AccountType {
  switch (type) {
    case ProtoAccountType.CHECKING:
      return "checking";
    case ProtoAccountType.SAVINGS:
      return "savings";
    case ProtoAccountType.CREDIT_CARD:
      return "credit";
    case ProtoAccountType.CASH:
      return "cash";
    default:
      return "checking";
  }
}

function mapFrontendTypeToProto(type: AccountType): ProtoAccountType {
  switch (type) {
    case "checking":
      return ProtoAccountType.CHECKING;
    case "savings":
      return ProtoAccountType.SAVINGS;
    case "credit":
      return ProtoAccountType.CREDIT_CARD;
    case "cash":
      return ProtoAccountType.CASH;
    default:
      return ProtoAccountType.CHECKING;
  }
}

interface AccountMetadata {
  color?: string;
  sortOrder?: number;
  archived?: boolean;
  institution?: string;
  icon?: string;
}

function parseNameAndMetadata(rawName: string): { name: string; metadata: AccountMetadata } {
  const parts = rawName.split(" ||");
  if (parts.length > 1) {
    try {
      const metadata = JSON.parse(parts[1]);
      return { name: parts[0], metadata };
    } catch {
      // Fallback
    }
  }
  return { name: rawName, metadata: {} };
}

function formatNameWithMetadata(name: string, metadata: AccountMetadata): string {
  const cleanName = name.split(" ||")[0];
  return `${cleanName} ||${JSON.stringify(metadata)}`;
}

// ─── ApiBudgetRepository ──────────────────────────────────────────────────────

export class ApiBudgetRepository implements Repository<Budget> {
  async list(_query?: ListQuery<Budget>): Promise<Budget[]> {
    const res = await budgetClient.listBudgets({});
    if (!res.budgets) return [];

    return Promise.all(
      res.budgets.map(async (b) => {
        // Fetch categories to build targets
        let targets: Budget["targets"] = [];
        try {
          const catRes = await categoryClient.listCategories({ budgetId: b.id });
          const cats = catRes.categories ?? [];
          targets = cats
            .filter((c) => c.targetLimit > 0n)
            .map((c) => ({
              categoryId: c.id,
              amount: Number(c.targetLimit) as Cents,
              frequency: "monthly" as const,
              mode: "envelope" as const,
              openedAt: tsToDateStr(b.createdAt),
            }));
        } catch {}

        return {
          id: b.id,
          name: b.name,
          period: "monthly" as const,
          startDate: tsToDateStr(b.createdAt),
          targets,
          active: true,
          createdAt: tsToISO(b.createdAt),
          updatedAt: tsToISO(b.updatedAt),
        };
      }),
    );
  }

  async get(id: string): Promise<Budget | null> {
    try {
      const res = await budgetClient.getBudget({ budgetId: id });
      const b = res.budget;
      if (!b) return null;

      let targets: Budget["targets"] = [];
      try {
        const catRes = await categoryClient.listCategories({ budgetId: b.id });
        const cats = catRes.categories ?? [];
        targets = cats
          .filter((c) => c.targetLimit > 0n)
          .map((c) => ({
            categoryId: c.id,
            amount: Number(c.targetLimit) as Cents,
            frequency: "monthly" as const,
            mode: "envelope" as const,
            openedAt: tsToDateStr(b.createdAt),
          }));
      } catch {}

      return {
        id: b.id,
        name: b.name,
        period: "monthly",
        startDate: tsToDateStr(b.createdAt),
        targets,
        active: true,
        createdAt: tsToISO(b.createdAt),
        updatedAt: tsToISO(b.updatedAt),
      };
    } catch {
      return null;
    }
  }

  async upsert(entity: Budget): Promise<Budget> {
    const existing = await this.get(entity.id);
    const hasEnvelope = entity.targets?.some((t) => t.mode === "envelope");
    const method = hasEnvelope ? BudgetMethod.ENVELOPE : BudgetMethod.ZERO_SUM;

    let budgetId: string;
    if (existing) {
      const res = await budgetClient.updateBudget({
        budgetId: entity.id,
        name: entity.name,
        method,
        currency: "AUD",
      });
      budgetId = res.budget?.id ?? entity.id;
    } else {
      const res = await budgetClient.createBudget({
        name: entity.name,
        method,
        currency: "AUD",
      });
      if (!res.budget) throw new Error("Failed to create budget");
      budgetId = res.budget.id;
    }

    // Sync targets to backend categories' target_limits
    if (entity.targets && entity.targets.length > 0) {
      for (const target of entity.targets) {
        try {
          const catRes = await categoryClient.listCategories({ budgetId });
          const cats = catRes.categories ?? [];
          const existingCat = cats.find((c) => c.id === target.categoryId);
          if (existingCat) {
            await categoryClient.updateCategory({
              budgetId,
              categoryId: target.categoryId,
              targetLimit: BigInt(target.amount),
            });
          }
        } catch {}
      }
    }

    return {
      id: budgetId,
      name: entity.name,
      period: entity.period || "monthly",
      startDate: entity.startDate,
      targets: entity.targets || [],
      active: entity.active ?? true,
      createdAt: entity.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async bulkUpsert(entities: Budget[]): Promise<Budget[]> {
    return Promise.all(entities.map((e) => this.upsert(e)));
  }

  async delete(id: string): Promise<void> {
    await budgetClient.deleteBudget({ budgetId: id });
    clearActiveBudgetIdCache();
  }

  async count(_query?: ListQuery<Budget>): Promise<number> {
    return (await this.list()).length;
  }
}

function resolveAccount(a: any): Account {
  const { name, metadata } = parseNameAndMetadata(a.name);
  const type = mapProtoTypeToFrontend(a.type);
  return {
    id: a.id,
    name,
    type,
    openingBalance: Number(a.balance) as Cents,
    currentBalance: Number(a.balance) as Cents,
    currency: "AUD",
    color: metadata.color || ACCOUNT_DEFAULT_COLOR[type] || "#7c5cff",
    archived: metadata.archived !== undefined ? metadata.archived : false,
    sortOrder: metadata.sortOrder !== undefined ? metadata.sortOrder : 0,
    createdAt: tsToISO(a.createdAt),
    updatedAt: tsToISO(a.updatedAt),
    connectionId: a.connectionId || undefined,
    institutionId: a.institutionId || undefined,
    lastUpdated: a.lastUpdated ? tsToISO(a.lastUpdated) : undefined,
    institution: metadata.institution || undefined,
    icon: metadata.icon || undefined,
  };
}

// ─── ApiAccountRepository ─────────────────────────────────────────────────────

export class ApiAccountRepository implements Repository<Account> {
  async list(_query?: ListQuery<Account>): Promise<Account[]> {
    const budgetId = await getActiveBudgetId();
    const res = await accountClient.listAccounts({ budgetId });
    const accs = res.accounts ?? [];
    return accs.map(resolveAccount);
  }

  async get(id: string): Promise<Account | null> {
    const all = await this.list();
    return all.find((a) => a.id === id) ?? null;
  }

  async upsert(entity: Account): Promise<Account> {
    const existing = await this.get(entity.id);
    const budgetId = await getActiveBudgetId();

    const rawName = formatNameWithMetadata(entity.name, {
      color: entity.color,
      sortOrder: entity.sortOrder,
      archived: entity.archived,
      institution: entity.institution,
      icon: entity.icon,
    });

    if (existing) {
      const res = await accountClient.updateAccount({
        budgetId,
        accountId: entity.id,
        name: rawName,
        type: mapFrontendTypeToProto(entity.type),
        balance: BigInt(entity.openingBalance),
      });
      const a = res.account!;
      return resolveAccount(a);
    } else {
      const res = await accountClient.createAccount({
        budgetId,
        name: rawName,
        type: mapFrontendTypeToProto(entity.type),
        balance: BigInt(entity.openingBalance),
      });
      const a = res.account!;
      return resolveAccount(a);
    }
  }

  async bulkUpsert(entities: Account[]): Promise<Account[]> {
    return Promise.all(entities.map((e) => this.upsert(e)));
  }

  async delete(id: string): Promise<void> {
    const budgetId = await getActiveBudgetId();
    await accountClient.deleteAccount({ budgetId, accountId: id });
  }

  async count(_query?: ListQuery<Account>): Promise<number> {
    return (await this.list()).length;
  }
}

// ─── ApiCategoryRepository ────────────────────────────────────────────────────

export class ApiCategoryRepository implements Repository<Category> {
  async list(_query?: ListQuery<Category>): Promise<Category[]> {
    const budgetId = await getActiveBudgetId();
    const res = await categoryClient.listCategories({ budgetId });
    const cats = res.categories ?? [];

    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: null,
      type: "expense" as const,
      color: "#7c5cff",
      archived: false,
      sortOrder: 0,
      system: false,
    }));
  }

  async get(id: string): Promise<Category | null> {
    const all = await this.list();
    return all.find((c) => c.id === id) ?? null;
  }

  async upsert(entity: Category): Promise<Category> {
    const existing = await this.get(entity.id);
    const budgetId = await getActiveBudgetId();

    if (existing) {
      const res = await categoryClient.updateCategory({
        budgetId,
        categoryId: entity.id,
        name: entity.name,
        targetLimit: 0n,
      });
      const c = res.category!;
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
    } else {
      const res = await categoryClient.createCategory({
        budgetId,
        name: entity.name,
        targetLimit: 0n,
      });
      const c = res.category!;
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
  }

  async bulkUpsert(entities: Category[]): Promise<Category[]> {
    return Promise.all(entities.map((e) => this.upsert(e)));
  }

  async delete(id: string): Promise<void> {
    const budgetId = await getActiveBudgetId();
    await categoryClient.deleteCategory({ budgetId, categoryId: id });
  }

  async count(_query?: ListQuery<Category>): Promise<number> {
    return (await this.list()).length;
  }
}

// ─── ApiTransactionRepository ─────────────────────────────────────────────────

export class ApiTransactionRepository implements Repository<Transaction> {
  async list(_query?: ListQuery<Transaction>): Promise<Transaction[]> {
    const budgetId = await getActiveBudgetId();
    const res = await transactionClient.listTransactions({ budgetId });
    const txns = res.transactions ?? [];

    return txns.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      date: tsToDateStr(t.date),
      amount: Math.abs(Number(t.amount)) as Cents,
      type: t.amount > 0n ? "credit" : "debit",
      categoryId: t.categoryId || null,
      payee: t.description,
      tags: [],
      cleared: true,
      createdAt: tsToISO(t.createdAt),
      updatedAt: tsToISO(t.updatedAt),
    }));
  }

  async get(id: string): Promise<Transaction | null> {
    const all = await this.list();
    return all.find((t) => t.id === id) ?? null;
  }

  async upsert(entity: Transaction): Promise<Transaction> {
    const existing = await this.get(entity.id);
    const budgetId = await getActiveBudgetId();
    const amount = BigInt(entity.type === "debit" ? -entity.amount : entity.amount);
    const dateTs = {
      seconds: BigInt(Math.floor(new Date(entity.date).getTime() / 1000)),
      nanos: 0,
    };

    if (existing) {
      const res = await transactionClient.updateTransaction({
        budgetId,
        transactionId: entity.id,
        accountId: entity.accountId,
        categoryId: entity.categoryId || "",
        amount,
        description: entity.payee || "Transaction",
        date: dateTs,
      });
      const t = res.transaction!;
      return {
        id: t.id,
        accountId: t.accountId,
        date: tsToDateStr(t.date),
        amount: Math.abs(Number(t.amount)) as Cents,
        type: t.amount > 0n ? "credit" : "debit",
        categoryId: t.categoryId || null,
        payee: t.description,
        tags: [],
        cleared: true,
        createdAt: tsToISO(t.createdAt),
        updatedAt: tsToISO(t.updatedAt),
      };
    } else {
      const res = await transactionClient.createTransaction({
        budgetId,
        accountId: entity.accountId,
        categoryId: entity.categoryId || "",
        amount,
        description: entity.payee || "Transaction",
        date: dateTs,
      });
      const t = res.transaction!;
      return {
        id: t.id,
        accountId: t.accountId,
        date: tsToDateStr(t.date),
        amount: Math.abs(Number(t.amount)) as Cents,
        type: t.amount > 0n ? "credit" : "debit",
        categoryId: t.categoryId || null,
        payee: t.description,
        tags: [],
        cleared: true,
        createdAt: tsToISO(t.createdAt),
        updatedAt: tsToISO(t.updatedAt),
      };
    }
  }

  async bulkUpsert(entities: Transaction[]): Promise<Transaction[]> {
    return Promise.all(entities.map((e) => this.upsert(e)));
  }

  async delete(id: string): Promise<void> {
    const budgetId = await getActiveBudgetId();
    await transactionClient.deleteTransaction({ budgetId, transactionId: id });
  }

  async count(_query?: ListQuery<Transaction>): Promise<number> {
    return (await this.list()).length;
  }
}
