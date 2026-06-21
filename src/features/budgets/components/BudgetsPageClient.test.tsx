import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { cents } from "@/lib/money/cents";
import { BudgetsPageClient } from "./BudgetsPageClient";

vi.mock("@/features/transactions/hooks", () => ({
  useTransactions: vi.fn(() => ({ data: [] })),
}));

vi.mock("../api/hooks", () => ({
  useBackendBudgets: vi.fn(),
  useSelectedBudgetId: vi.fn(),
  useBackendCategories: vi.fn(),
  useBackendAccounts: vi.fn(),
  useAllUserAccounts: vi.fn(() => ({ data: [] })),
  useBudgetViewCadence: vi.fn(() => ({
    viewCadence: "monthly",
    setViewCadence: vi.fn(),
    periodOffset: 0,
    setPeriodOffset: vi.fn(),
  })),
  useBackendBudgetSummary: vi.fn(),
  useCreateBackendBudget: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useUpdateBackendBudget: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useDeleteBackendBudget: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useAssignCategoryFunds: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useAddCategoryToBudget: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
  useBackendAvailableCategories: vi.fn(() => ({ data: [], isPending: false })),
  useSyncBudgetAccountLinks: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

import {
  useBackendAccounts,
  useBackendBudgetSummary,
  useBackendBudgets,
  useBackendCategories,
  useSelectedBudgetId,
} from "../api/hooks";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BudgetsPageClient />
    </QueryClientProvider>,
  );
}

describe("BudgetsPageClient", () => {
  it("shows loading skeleton while budgets fetch", () => {
    vi.mocked(useBackendBudgets).mockReturnValue({
      data: undefined,
      isPending: true,
    } as never);
    vi.mocked(useSelectedBudgetId).mockReturnValue({ selectedId: null, selectBudget: vi.fn() });
    vi.mocked(useBackendCategories).mockReturnValue({ data: undefined, isPending: false } as never);
    vi.mocked(useBackendAccounts).mockReturnValue({ data: [] } as never);
    vi.mocked(useBackendBudgetSummary).mockReturnValue(null);

    const { container } = renderPage();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });

  it("shows empty state when no budgets exist", () => {
    vi.mocked(useBackendBudgets).mockReturnValue({
      data: [],
      isPending: false,
    } as never);
    vi.mocked(useSelectedBudgetId).mockReturnValue({ selectedId: null, selectBudget: vi.fn() });
    vi.mocked(useBackendCategories).mockReturnValue({ data: [], isPending: false } as never);
    vi.mocked(useBackendAccounts).mockReturnValue({ data: [] } as never);
    vi.mocked(useBackendBudgetSummary).mockReturnValue(null);

    renderPage();
    expect(screen.getByText("Create your first budget")).toBeInTheDocument();
  });

  it("renders budget summary and categories when data is present", () => {
    vi.mocked(useBackendBudgets).mockReturnValue({
      data: [
        {
          id: "b1",
          name: "Household",
          currency: "AUD",
          period: "monthly",
          startDate: "2024-01-01",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
      ],
      isPending: false,
    } as never);
    vi.mocked(useSelectedBudgetId).mockReturnValue({ selectedId: "b1", selectBudget: vi.fn() });
    vi.mocked(useBackendCategories).mockReturnValue({
      data: [
        {
          id: "c1",
          name: "Groceries",
          type: "expense",
          parentId: null,
          system: false,
          budgeted: cents(50000),
          balance: cents(30000),
          targetLimit: cents(0),
          budgetedFrequency: "monthly",
        },
      ],
      isPending: false,
    } as never);
    vi.mocked(useBackendAccounts).mockReturnValue({ data: [] } as never);
    vi.mocked(useBackendBudgetSummary).mockReturnValue({
      kind: "period",
      periodReceived: cents(800000),
      periodSpent: cents(12000),
      periodNet: cents(788000),
      budgetedIncome: cents(800000),
      budgetedExpenses: cents(50000),
      budgetedNet: cents(750000),
    });

    renderPage();
    expect(screen.getByText("Household")).toBeInTheDocument();
    expect(screen.getByText(/^Net/)).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set target" })).toBeInTheDocument();
  });
});
