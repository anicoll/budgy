import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cents } from "@/lib/money/cents";
import {
  ApiAccountRepository,
  ApiBudgetRepository,
  ApiCategoryRepository,
  ApiTransactionRepository,
  clearActiveBudgetIdCache,
  getActiveBudgetId,
} from "./api-repository";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

beforeEach(() => {
  clearActiveBudgetIdCache();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getActiveBudgetId", () => {
  it("returns the first budget id when budgets exist", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "b1", name: "Budget 1" }]));
    const id = await getActiveBudgetId();
    expect(id).toBe("b1");
  });

  it("creates a default budget when none exist", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: "new-b",
        name: "Default Budget",
        method: "ZERO_SUM",
        currency: "AUD",
      }),
    );
    const id = await getActiveBudgetId();
    expect(id).toBe("new-b");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("caches the budget id after the first call", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "cached-id", name: "B" }]));
    await getActiveBudgetId();
    const id2 = await getActiveBudgetId();
    expect(id2).toBe("cached-id");
    // Only one fetch call (cached)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("ApiBudgetRepository", () => {
  const repo = new ApiBudgetRepository();

  it("list returns empty array when API returns null", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null));
    const result = await repo.list();
    expect(result).toEqual([]);
  });

  it("list maps Go budgets to frontend Budget type", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "b1",
          name: "Test Budget",
          method: "ZERO_SUM",
          currency: "AUD",
          created_at: "2024-01-15T00:00:00Z",
          updated_at: "2024-01-15T00:00:00Z",
        },
      ]),
    );
    // Categories fetch for targets
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b1");
    expect(result[0].name).toBe("Test Budget");
    expect(result[0].period).toBe("monthly");
    expect(result[0].active).toBe(true);
  });

  it("get returns null on 404", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(null, 404));
    const result = await repo.get("nonexistent");
    expect(result).toBeNull();
  });

  it("count returns number of budgets", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "b1",
          name: "B1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "b2",
          name: "B2",
          created_at: "2024-02-01T00:00:00Z",
          updated_at: "2024-02-01T00:00:00Z",
        },
      ]),
    );
    // Categories fetch for each budget
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const count = await repo.count();
    expect(count).toBe(2);
  });
});

describe("ApiAccountRepository", () => {
  const repo = new ApiAccountRepository();

  it("list maps Go accounts to frontend Account type", async () => {
    // First call for getActiveBudgetId
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "b1", name: "B1" }]));
    // Second call for accounts
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "a1",
          budget_id: "b1",
          name: "Checking",
          type: "CHECKING",
          balance: 50000,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ]),
    );

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
    expect(result[0].name).toBe("Checking");
    expect(result[0].type).toBe("checking");
    expect(result[0].openingBalance).toBe(50000);
    expect(result[0].currentBalance).toBe(50000);
    expect(result[0].currency).toBe("AUD");
  });

  it("list returns empty array when API returns null", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "b1", name: "B1" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse(null));

    const result = await repo.list();
    expect(result).toEqual([]);
  });

  it("get returns null for nonexistent account", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "b1", name: "B1" }]));
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    const result = await repo.get("nonexistent");
    expect(result).toBeNull();
  });
});

describe("ApiCategoryRepository", () => {
  const repo = new ApiCategoryRepository();

  it("list maps Go categories to frontend Category type", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "b1", name: "B1" }]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "c1",
          budget_id: "b1",
          name: "Groceries",
          budgeted: 10000,
          balance: 5000,
          target_limit: 15000,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ]),
    );

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("c1");
    expect(result[0].name).toBe("Groceries");
    expect(result[0].type).toBe("expense");
    expect(result[0].archived).toBe(false);
  });
});

describe("ApiTransactionRepository", () => {
  const repo = new ApiTransactionRepository();

  it("list maps Go transactions to frontend Transaction type", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "b1", name: "B1" }]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "t1",
          budget_id: "b1",
          account_id: "a1",
          category_id: "c1",
          amount: -5000,
          description: "Woolworths",
          date: "2024-01-15T00:00:00Z",
          created_at: "2024-01-15T00:00:00Z",
          updated_at: "2024-01-15T00:00:00Z",
        },
      ]),
    );

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
    expect(result[0].accountId).toBe("a1");
    expect(result[0].amount).toBe(-5000);
    expect(result[0].type).toBe("debit");
    expect(result[0].categoryId).toBe("c1");
    expect(result[0].payee).toBe("Woolworths");
  });

  it("maps positive amounts to credit type", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "b1", name: "B1" }]));
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "t2",
          budget_id: "b1",
          account_id: "a1",
          category_id: "",
          amount: 150000,
          description: "Salary",
          date: "2024-01-31T00:00:00Z",
          created_at: "2024-01-31T00:00:00Z",
          updated_at: "2024-01-31T00:00:00Z",
        },
      ]),
    );

    const result = await repo.list();
    expect(result[0].type).toBe("credit");
    expect(result[0].categoryId).toBeNull();
  });

  it("upsert sends POST and returns mapped transaction", async () => {
    // getActiveBudgetId
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "b1", name: "B1" }]));
    // get() -> list() for existence check
    mockFetch.mockResolvedValueOnce(jsonResponse([]));
    // POST create
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: "new-t1",
        budget_id: "b1",
        account_id: "a1",
        category_id: "c1",
        amount: -3000,
        description: "Test",
        date: "2024-02-01T00:00:00Z",
        created_at: "2024-02-01T00:00:00Z",
        updated_at: "2024-02-01T00:00:00Z",
      }),
    );

    const result = await repo.upsert({
      id: "temp-id",
      accountId: "a1",
      date: "2024-02-01T00:00:00Z",
      amount: -3000 as Cents,
      type: "debit",
      categoryId: "c1",
      payee: "Test",
      tags: [],
      cleared: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(result.id).toBe("new-t1");
    expect(result.amount).toBe(-3000);
    expect(result.type).toBe("debit");
  });
});
