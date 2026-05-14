export const queryKeys = {
  accounts: {
    all: ["accounts"] as const,
    list: (opts?: { archived?: boolean }) => ["accounts", "list", opts ?? {}] as const,
    byId: (id: string) => ["accounts", "byId", id] as const,
  },
  categories: {
    all: ["categories"] as const,
    list: () => ["categories", "list"] as const,
  },
  transactions: {
    all: ["transactions"] as const,
    list: (opts?: Record<string, unknown>) => ["transactions", "list", opts ?? {}] as const,
    byId: (id: string) => ["transactions", "byId", id] as const,
  },
  budgets: {
    all: ["budgets"] as const,
    list: () => ["budgets", "list"] as const,
  },
} as const;
