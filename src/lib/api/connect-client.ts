import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { AccountService } from "@/gen/budgy/v1/account_connect";
import { AuthService } from "@/gen/budgy/v1/auth_connect";
import { BankSyncService } from "@/gen/budgy/v1/basiq_connect";
import { BudgetService } from "@/gen/budgy/v1/budget_connect";
import { CategoryService } from "@/gen/budgy/v1/category_connect";
import { TransactionService } from "@/gen/budgy/v1/transaction_connect";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Connect transport configured for the budgy backend.
 * Uses the Connect protocol (default) which supports HTTP/1.1 + JSON,
 * and forwards cookies for session authentication.
 */
const transport = createConnectTransport({
  baseUrl: API_BASE_URL,
  fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: "include" }),
});

export const authClient = createClient(AuthService, transport);
export const budgetClient = createClient(BudgetService, transport);
export const accountClient = createClient(AccountService, transport);
export const categoryClient = createClient(CategoryService, transport);
export const transactionClient = createClient(TransactionService, transport);
export const bankSyncClient = createClient(BankSyncService, transport);
