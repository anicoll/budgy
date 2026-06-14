import { bankSyncClient } from "@/lib/api/connect-client";

export interface BasiqAuthLinkResponse {
  token: string;
  connect_url: string;
}

/**
 * Requests the single-use token and connect URL for Basiq Link redirection.
 */
export async function getBasiqAuthLink(): Promise<BasiqAuthLinkResponse> {
  const res = await bankSyncClient.getBasiqAuthLink({});
  if (!res.authLink) throw new Error("Failed to retrieve Basiq connection link");
  return {
    token: res.authLink.token,
    connect_url: res.authLink.connectUrl,
  };
}

/**
 * Triggers a manual synchronisation of accounts and transactions for the connected Basiq User.
 */
export async function syncBasiq(): Promise<{ message: string }> {
  const res = await bankSyncClient.syncBank({});
  return { message: res.message };
}
