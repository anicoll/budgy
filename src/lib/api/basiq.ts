const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const originalFetch = globalThis.fetch;
function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return originalFetch(input, {
    ...init,
    credentials: "include",
  });
}

export interface BasiqAuthLinkResponse {
  token: string;
  connect_url: string;
}

/**
 * Requests the single-use token and connect URL for Basiq Link redirection.
 */
export async function getBasiqAuthLink(): Promise<BasiqAuthLinkResponse> {
  const res = await authFetch(`${API_BASE_URL}/api/basiq/auth-link`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to retrieve Basiq connection link");
  }
  return res.json();
}

/**
 * Triggers a manual synchronization of accounts and transactions for the connected Basiq User.
 */
export async function syncBasiq(): Promise<{ message: string }> {
  const res = await authFetch(`${API_BASE_URL}/api/basiq/sync`, {
    method: "POST",
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to synchronize bank accounts");
  }
  return res.json();
}
