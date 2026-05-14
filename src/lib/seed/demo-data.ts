import { format, subDays, subMonths } from "date-fns";
import { seedDefaultCategories } from "@/features/categories/repository";
import type { BudgyExport } from "@/lib/data/export-import";
import { importData } from "@/lib/data/export-import";
import { getRepositories } from "@/lib/storage";

const D = (d: Date) => format(d, "yyyy-MM-dd");
const NOW = new Date();

function id(prefix: string, n: number) {
  return `demo-${prefix}-${String(n).padStart(4, "0")}`;
}

export async function loadDemoData(): Promise<void> {
  await seedDefaultCategories();

  const repos = getRepositories();
  const cats = await repos.categories.list();
  const catId = (name: string) =>
    cats.find((c) => c.name.toLowerCase().includes(name.toLowerCase()))?.id ?? null;

  // ── Accounts ────────────────────────────────────────────────────────────
  const accounts = [
    {
      id: id("acc", 1),
      name: "Everyday",
      type: "checking",
      institution: "ANZ",
      openingBalance: 420000,
      currentBalance: 420000,
      currency: "AUD",
      color: "#7c5cff",
      archived: false,
      sortOrder: 0,
      createdAt: D(subMonths(NOW, 4)),
      updatedAt: D(NOW),
    },
    {
      id: id("acc", 2),
      name: "Savings",
      type: "savings",
      institution: "ING",
      openingBalance: 1800000,
      currentBalance: 1800000,
      currency: "AUD",
      color: "#22c1c3",
      archived: false,
      sortOrder: 1,
      createdAt: D(subMonths(NOW, 4)),
      updatedAt: D(NOW),
    },
    {
      id: id("acc", 3),
      name: "Visa Platinum",
      type: "credit",
      institution: "CommBank",
      openingBalance: 0,
      currentBalance: 0,
      currency: "AUD",
      color: "#ef4f6c",
      archived: false,
      sortOrder: 2,
      createdAt: D(subMonths(NOW, 4)),
      updatedAt: D(NOW),
    },
  ];

  // ── Transactions (3 months of daily activity) ──────────────────────────
  type Txn = {
    id: string;
    accountId: string;
    date: string;
    amount: number;
    type: string;
    transferDirection?: string;
    categoryId: string | null;
    payee?: string;
    description?: string;
    tags: string[];
    transferAccountId?: string;
    transferPairId?: string;
    cleared: boolean;
    createdAt: string;
    updatedAt: string;
  };
  const transactions: Txn[] = [];
  let txnIdx = 1;

  function txn(
    daysAgo: number,
    accountKey: 1 | 2 | 3,
    type: "debit" | "credit" | "transfer",
    amount: number,
    payee: string,
    categoryName: string | null,
    cleared = true,
  ) {
    const txnId = id("txn", txnIdx++);
    const date = D(subDays(NOW, daysAgo));
    transactions.push({
      id: txnId,
      accountId: id("acc", accountKey),
      date,
      amount,
      type,
      categoryId: categoryName ? catId(categoryName) : null,
      payee,
      tags: [],
      cleared,
      createdAt: date,
      updatedAt: date,
    });
  }

  // Monthly salary
  for (let m = 0; m < 3; m++) {
    txn(m * 30 + 1, 1, "credit", 720000, "Acme Corp", "Salary");
  }

  // Regular expenses across 3 months
  const expenses: Array<[number[], 1 | 2 | 3, number, string, string]> = [
    [[2, 32, 62], 1, 42000, "Coles", "Groceries"],
    [[5, 35, 65], 1, 38000, "Woolworths", "Groceries"],
    [[3, 33, 63], 1, 8500, "Crust Pizza", "Dining"],
    [[8, 38, 68], 3, 12000, "Restaurant Hubert", "Dining"],
    [[10, 40, 70], 1, 7200, "Shell", "Fuel"],
    [[12, 42, 72], 1, 4800, "Opal Card", "Public transport"],
    [[4, 34, 64], 1, 22000, "AGL Energy", "Utilities"],
    [[15, 45, 75], 3, 1800, "Netflix", "Subscriptions"],
    [[15, 45, 75], 3, 1700, "Spotify", "Subscriptions"],
    [[15, 45, 75], 3, 9900, "iCloud", "Subscriptions"],
    [[20, 50, 80], 1, 32000, "NRMA Insurance", "Insurance"],
    [[22, 52, 82], 3, 15000, "Flight Centre", "Travel"],
    [[25, 55, 85], 1, 5500, "Chemist Warehouse", "Health"],
    [[18, 48, 78], 3, 8900, "Cotton On", "Clothing"],
    [[6, 36, 66], 1, 3200, "Haircut", "Personal care"],
  ];

  for (const [days, acc, amount, payee, cat] of expenses) {
    for (const d of days) {
      txn(d, acc, "debit", amount, payee, cat);
    }
  }

  // Monthly savings transfer
  for (let m = 0; m < 3; m++) {
    const srcId = id("txn", txnIdx++);
    const dstId = id("txn", txnIdx++);
    const date = D(subDays(NOW, m * 30 + 3));
    transactions.push(
      {
        id: srcId,
        accountId: id("acc", 1),
        date,
        amount: 150000,
        type: "transfer",
        transferDirection: "out",
        transferAccountId: id("acc", 2),
        transferPairId: dstId,
        categoryId: catId("Savings"),
        payee: "Savings transfer",
        tags: [],
        cleared: true,
        createdAt: date,
        updatedAt: date,
      },
      {
        id: dstId,
        accountId: id("acc", 2),
        date,
        amount: 150000,
        type: "transfer",
        transferDirection: "in",
        transferAccountId: id("acc", 1),
        transferPairId: srcId,
        categoryId: catId("Savings"),
        payee: "Savings transfer",
        tags: [],
        cleared: true,
        createdAt: date,
        updatedAt: date,
      },
    );
  }

  // ── Budget ───────────────────────────────────────────────────────────────
  const budgets = [
    {
      id: id("bud", 1),
      name: "Monthly budget",
      period: "monthly",
      startDate: D(subMonths(NOW, 3)),
      categoryAllocations: [
        { categoryId: catId("Groceries"), amount: 90000, rollover: false },
        { categoryId: catId("Dining"), amount: 30000, rollover: false },
        { categoryId: catId("Fuel"), amount: 15000, rollover: true },
        { categoryId: catId("Utilities"), amount: 25000, rollover: false },
        { categoryId: catId("Subscriptions"), amount: 5000, rollover: false },
        { categoryId: catId("Insurance"), amount: 35000, rollover: false },
        { categoryId: catId("Health"), amount: 10000, rollover: true },
        { categoryId: catId("Clothing"), amount: 20000, rollover: true },
      ].filter((a) => a.categoryId !== null),
      notes: "Auto-generated demo budget",
      active: true,
      createdAt: D(subMonths(NOW, 3)),
      updatedAt: D(NOW),
    },
  ];

  const exportData: BudgyExport = {
    version: 1,
    exportedAt: NOW.toISOString(),
    accounts: accounts as BudgyExport["accounts"],
    categories: [],
    transactions: transactions as BudgyExport["transactions"],
    budgets: budgets as BudgyExport["budgets"],
  };

  await importData(exportData, "merge");
}
