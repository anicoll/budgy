export type CategoryType = "income" | "expense" | "transfer";

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  type: CategoryType;
  icon?: string;
  color: string;
  archived: boolean;
  sortOrder: number;
  system?: boolean; // true = cannot be archived, deleted, or removed from budget
}

export const CATEGORY_TYPE_LABEL: Record<CategoryType, string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

export const CATEGORY_DEFAULT_COLORS = [
  "#7c5cff",
  "#22c1c3",
  "#34d399",
  "#f5b942",
  "#fb7185",
  "#ef4f6c",
  "#a78bfa",
  "#60a5fa",
  "#f97316",
  "#94a3b8",
  "#e879f9",
  "#4ade80",
];
