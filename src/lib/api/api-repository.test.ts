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

// Mock global fetch for Connect RPC JSON protocol
// Connect uses POST and returns {"result": <response_message>} or the message directly
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Connect RPC JSON protocol wraps responses in the response message fields directly
// For a ListBudgetsResponse: { "budgets": [...] }
function connectResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

// Helper: budget proto-like object for connect responses
function budgetMsg(id: string, name = "Test") {
  return {
    id,
    name,
    method: 1, // BUDGET_METHOD_ZERO_SUM = 1
    currency: "AUD",
    createdAt: "2024-01-15T00:00:00Z",
    updatedAt: "2024-01-15T00:00:00Z",
  };
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
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1")] }));
    const id = await getActiveBudgetId();
    expect(id).toBe("b1");
  });

  it("creates a default budget when none exist", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [] }));
    mockFetch.mockResolvedValueOnce(connectResponse({ budget: budgetMsg("new-b", "Default Budget") }));
    const id = await getActiveBudgetId();
    expect(id).toBe("new-b");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("caches the budget id after the first call", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("cached-id")] }));
    await getActiveBudgetId();
    const id2 = await getActiveBudgetId();
    expect(id2).toBe("cached-id");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("ApiBudgetRepository", () => {
  const repo = new ApiBudgetRepository();

  it("list returns empty array when API returns no budgets", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [] }));
    const result = await repo.list();
    expect(result).toEqual([]);
  });

  it("list maps proto budgets to frontend Budget type", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1", "Test Budget")] }));
    // Categories fetch for targets (listCategories)
    mockFetch.mockResolvedValueOnce(connectResponse({ categories: [] }));

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b1");
    expect(result[0].name).toBe("Test Budget");
    expect(result[0].period).toBe("monthly");
    expect(result[0].active).toBe(true);
  });

  it("get returns null on error", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ code: "not_found" }, 404));
    const result = await repo.get("nonexistent");
    expect(result).toBeNull();
  });

  it("count returns number of budgets", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1"), budgetMsg("b2")] }));
    // Categories for each budget
    mockFetch.mockResolvedValueOnce(connectResponse({ categories: [] }));
    mockFetch.mockResolvedValueOnce(connectResponse({ categories: [] }));

    const count = await repo.count();
    expect(count).toBe(2);
  });
});

describe("ApiAccountRepository", () => {
  const repo = new ApiAccountRepository();

  function accountMsg(id: string, name: string, type = 1, balance = 50000) {
    return {
      id,
      budgetId: "b1",
      name,
      type,
      balance: String(balance),
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
  }

  it("list maps proto accounts to frontend Account type", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1")] }));
    mockFetch.mockResolvedValueOnce(connectResponse({ accounts: [accountMsg("a1", "Checking")] }));

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
    expect(result[0].name).toBe("Checking");
    expect(result[0].type).toBe("checking");
    expect(result[0].currency).toBe("AUD");
  });

  it("list returns empty array when API returns no accounts", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1")] }));
    mockFetch.mockResolvedValueOnce(connectResponse({ accounts: [] }));

    const result = await repo.list();
    expect(result).toEqual([]);
  });

  it("get returns null for nonexistent account", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1")] }));
    mockFetch.mockResolvedValueOnce(connectResponse({ accounts: [] }));

    const result = await repo.get("nonexistent");
    expect(result).toBeNull();
  });
});

describe("ApiCategoryRepository", () => {
  const repo = new ApiCategoryRepository();

  function categoryMsg(id: string, name: string) {
    return {
      id,
      budgetId: "b1",
      name,
      budgeted: "10000",
      balance: "5000",
      targetLimit: "15000",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
  }

  it("list maps proto categories to frontend Category type", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1")] }));
    mockFetch.mockResolvedValueOnce(connectResponse({ categories: [categoryMsg("c1", "Groceries")] }));

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

  function txMsg(id: string, amount: string, description: string, categoryId = "c1") {
    return {
      id,
      budgetId: "b1",
      accountId: "a1",
      categoryId,
      amount,
      description,
      date: "2024-01-15T00:00:00Z",
      createdAt: "2024-01-15T00:00:00Z",
      updatedAt: "2024-01-15T00:00:00Z",
    };
  }

  it("list maps proto transactions to frontend Transaction type (debit)", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1")] }));
    mockFetch.mockResolvedValueOnce(
      connectResponse({ transactions: [txMsg("t1", "-5000", "Woolworths")] }),
    );

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
    expect(result[0].accountId).toBe("a1");
    expect(result[0].amount).toBe(5000);
    expect(result[0].type).toBe("debit");
    expect(result[0].categoryId).toBe("c1");
    expect(result[0].payee).toBe("Woolworths");
  });

  it("maps positive amounts to credit type", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1")] }));
    mockFetch.mockResolvedValueOnce(
      connectResponse({ transactions: [txMsg("t2", "150000", "Salary", "")] }),
    );

    const result = await repo.list();
    expect(result[0].type).toBe("credit");
    expect(result[0].categoryId).toBeNull();
  });
});
