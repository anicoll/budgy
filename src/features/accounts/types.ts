import type { Cents } from "@/lib/money/cents";

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "cash"
  | "investment"
  | "loan"
  | "super";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution?: string;
  openingBalance: Cents;
  currentBalance: Cents;
  currency: "AUD";
  color: string;
  icon?: string;
  archived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: "Everyday",
  savings: "Savings",
  credit: "Credit card",
  cash: "Cash",
  investment: "Investment",
  loan: "Loan",
  super: "Super",
};

export const ACCOUNT_TYPE_ORDER: AccountType[] = [
  "checking",
  "savings",
  "credit",
  "cash",
  "investment",
  "loan",
  "super",
];

export const ACCOUNT_DEFAULT_COLOR: Record<AccountType, string> = {
  checking: "#7c5cff",
  savings: "#22c1c3",
  credit: "#ef4f6c",
  cash: "#f5b942",
  investment: "#34d399",
  loan: "#fb7185",
  super: "#a78bfa",
};

export const ACCOUNT_COLORS = [
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
];

export function isLiability(t: AccountType): boolean {
  return t === "credit" || t === "loan";
}
