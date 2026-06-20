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
    mockFetch.mockResolvedValueOnce(
      connectResponse({ budget: budgetMsg("new-b", "Default Budget") }),
    );
    const id = await getActiveBudgetId();
    expect(id).toBe("new-b");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("revalidates against the budget list on each call", async () => {
    mockFetch.mockResolvedValue(connectResponse({ budgets: [budgetMsg("cached-id")] }));
    await getActiveBudgetId();
    const id2 = await getActiveBudgetId();
    expect(id2).toBe("cached-id");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("prefers the selected budget from session storage when it exists", async () => {
    sessionStorage.setItem("budgy.selectedBudgetId", "b2");
    mockFetch.mockResolvedValueOnce(
      connectResponse({ budgets: [budgetMsg("b1"), budgetMsg("b2", "Second")] }),
    );
    const id = await getActiveBudgetId();
    expect(id).toBe("b2");
  });

  it("falls back when the cached budget no longer exists", async () => {
    sessionStorage.setItem("budgy.selectedBudgetId", "deleted-budget");
    mockFetch.mockResolvedValueOnce(connectResponse({ budgets: [budgetMsg("b1")] }));
    const id = await getActiveBudgetId();
    expect(id).toBe("b1");
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
    mockFetch.mockResolvedValueOnce(
      connectResponse({ budgets: [budgetMsg("b1"), budgetMsg("b2")] }),
    );
    // Categories for each budget
    mockFetch.mockResolvedValueOnce(connectResponse({ categories: [] }));
    mockFetch.mockResolvedValueOnce(connectResponse({ categories: [] }));

    const count = await repo.count();
    expect(count).toBe(2);
  });
});

describe("ApiAccountRepository", () => {
  const repo = new ApiAccountRepository();

  function accountMsg(id: string, name: string, type = 1, balance = 50000, extra = {}) {
    return {
      id,
      userId: "u1",
      name,
      type,
      balance: String(balance),
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      ...extra,
    };
  }

  it("list maps proto accounts to frontend Account type", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ accounts: [accountMsg("a1", "Checking")] }));

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a1");
    expect(result[0].name).toBe("Checking");
    expect(result[0].type).toBe("checking");
    expect(result[0].currency).toBe("AUD");
  });

  it("list parses metadata suffix from the account name", async () => {
    mockFetch.mockResolvedValueOnce(
      connectResponse({
        accounts: [
          accountMsg(
            "a1",
            'Savings ||{"color":"#00ff00","sortOrder":4,"archived":true,"institution":"MyBank","icon":"piggy"}',
          ),
        ],
      }),
    );

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Savings");
    expect(result[0].color).toBe("#00ff00");
    expect(result[0].sortOrder).toBe(4);
    expect(result[0].archived).toBe(true);
    expect(result[0].institution).toBe("MyBank");
    expect(result[0].icon).toBe("piggy");
  });

  it("list defaults metadata for synced accounts without suffix", async () => {
    mockFetch.mockResolvedValueOnce(
      connectResponse({
        accounts: [
          accountMsg("a1", "Synced Account", 2, 50000, {
            connectionId: "conn-123",
          }),
        ],
      }),
    );

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Synced Account");
    expect(result[0].connectionId).toBe("conn-123");
    expect(result[0].color).toBe("#22c1c3"); // Default savings color
    expect(result[0].archived).toBe(false);
    expect(result[0].sortOrder).toBe(0);
  });

  it("list handles empty name synced accounts by falling back to product name and maps class to frontend type", async () => {
    mockFetch.mockResolvedValueOnce(
      connectResponse({
        accounts: [
          accountMsg("a1", "", 1, 50000, {
            connectionId: "conn-123",
            product: "Hooli Home Loan",
            class: "mortgage",
          }),
        ],
      }),
    );

    const result = await repo.list();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Hooli Home Loan");
    expect(result[0].type).toBe("loan"); // mapped from mortgage class
  });
  it("upsert serializes metadata into name field suffix", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ accounts: [] }));
    mockFetch.mockResolvedValueOnce(
      connectResponse({
        account: accountMsg(
          "a1",
          'Savings ||{"color":"#00ff00","sortOrder":2,"archived":false,"institution":"Bank","icon":"icon"}',
        ),
      }),
    );

    const result = await repo.upsert({
      id: "a1",
      name: "Savings",
      type: "savings",
      openingBalance: 10000 as unknown as Cents,
      currentBalance: 10000 as unknown as Cents,
      currency: "AUD",
      color: "#00ff00",
      archived: false,
      sortOrder: 2,
      createdAt: "",
      updatedAt: "",
      institution: "Bank",
      icon: "icon",
    });

    expect(result.name).toBe("Savings");
    expect(result.color).toBe("#00ff00");
    expect(result.sortOrder).toBe(2);

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    const rawBody = lastCall[1].body;
    const decoded = typeof rawBody === "string" ? rawBody : new TextDecoder().decode(rawBody);
    const body = JSON.parse(decoded);
    expect(body.name).toBe(
      'Savings ||{"color":"#00ff00","sortOrder":2,"archived":false,"institution":"Bank","icon":"icon","type":"savings"}',
    );
  });

  it("list returns empty array when API returns no accounts", async () => {
    mockFetch.mockResolvedValueOnce(connectResponse({ accounts: [] }));

    const result = await repo.list();
    expect(result).toEqual([]);
  });

  it("get returns null for nonexistent account", async () => {
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
      userId: "u1",
      name,
      type: 2, // EXPENSE
      color: "#7c5cff",
      sortOrder: 0,
      archived: false,
      system: false,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
  }

  it("list maps proto categories to frontend Category type", async () => {
    mockFetch.mockResolvedValueOnce(
      connectResponse({ categories: [categoryMsg("c1", "Groceries")] }),
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
    mockFetch.mockResolvedValueOnce(
      connectResponse({ transactions: [txMsg("t2", "150000", "Salary", "")] }),
    );

    const result = await repo.list();
    expect(result[0].type).toBe("credit");
    expect(result[0].categoryId).toBeNull();
  });
});
