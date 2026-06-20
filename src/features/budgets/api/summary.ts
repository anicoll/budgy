import { addCents, cents } from "@/lib/money/cents";
import type {
  BackendAccount,
  BackendBudgetMethod,
  BackendBudgetSummary,
  BackendCategory,
  EnvelopeCategoryStatus,
} from "./types";

export function computeZeroSumSummary(
  accounts: BackendAccount[],
  categories: BackendCategory[],
): Extract<BackendBudgetSummary, { kind: "zero_sum" }> {
  let totalAvailable = 0;
  for (const acc of accounts) {
    totalAvailable += acc.balance;
  }

  let totalAssigned = 0;
  for (const cat of categories) {
    totalAssigned += cat.balance;
  }

  return {
    kind: "zero_sum",
    totalAvailableFunds: cents(totalAvailable),
    totalAssignedFunds: cents(totalAssigned),
    readyToAssign: cents(totalAvailable - totalAssigned),
  };
}

export function computeEnvelopeSummary(
  categories: BackendCategory[],
): Extract<BackendBudgetSummary, { kind: "envelope" }> {
  let totalBalance = 0;
  let onTrack = 0;
  let watch = 0;
  let overspent = 0;

  for (const cat of categories) {
    totalBalance += cat.balance;
    const status = envelopeCategoryStatus(cat);
    if (status === "on_track") onTrack += 1;
    else if (status === "watch") watch += 1;
    else overspent += 1;
  }

  return {
    kind: "envelope",
    totalBalance: cents(totalBalance),
    onTrack,
    watch,
    overspent,
  };
}

export function computeBudgetSummary(
  method: BackendBudgetMethod,
  accounts: BackendAccount[],
  categories: BackendCategory[],
): BackendBudgetSummary {
  if (method === "envelope") {
    return computeEnvelopeSummary(categories);
  }
  return computeZeroSumSummary(accounts, categories);
}

export function envelopeCategoryStatus(category: BackendCategory): EnvelopeCategoryStatus {
  if (category.balance < 0) return "overspent";
  if (category.targetLimit > 0 && category.balance < category.targetLimit) return "watch";
  return "on_track";
}

export function envelopeProgressRatio(category: BackendCategory): number {
  if (category.targetLimit <= 0) {
    return category.balance >= 0 ? 1 : 0;
  }
  return Math.max(0, category.balance / category.targetLimit);
}

export function envelopeStatusToUi(
  status: EnvelopeCategoryStatus,
): "healthy" | "watch" | "overspent" {
  if (status === "on_track") return "healthy";
  if (status === "watch") return "watch";
  return "overspent";
}

export function sumCategoryBalances(categories: BackendCategory[]) {
  return categories.reduce((sum, c) => addCents(sum, c.balance), cents(0));
}
