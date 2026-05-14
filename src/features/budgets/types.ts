import type { Cents } from "@/lib/money/cents";

export type BudgetPeriod = "weekly" | "fortnightly" | "monthly" | "yearly";

export const BUDGET_PERIOD_LABEL: Record<BudgetPeriod, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  yearly: "Yearly",
};

export interface CategoryAllocation {
  categoryId: string;
  amount: Cents;
  rollover: boolean;
}

export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  startDate: string;
  categoryAllocations: CategoryAllocation[];
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AllocationActual {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  allocated: Cents;
  spent: Cents;
  rolloverAmount: Cents;
  effectiveAllocated: Cents;
  remaining: Cents;
  rollover: boolean;
}
