const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  basiq_user_id?: string;
  created_at: string;
  updated_at: string;
}

const originalFetch = globalThis.fetch;
function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return originalFetch(input, {
    ...init,
    credentials: "include",
  });
}

export async function register(req: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}): Promise<User> {
  const res = await authFetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to register");
  }

  return res.json();
}

export async function login(req: { email: string; password: string }): Promise<User> {
  const res = await authFetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to login");
  }

  return res.json();
}

export async function logout(): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
  });

  if (!res.ok) {
    throw new Error("Failed to logout");
  }
}

export async function getMe(): Promise<User> {
  const res = await authFetch(`${API_BASE_URL}/api/auth/me`);

  if (!res.ok) {
    throw new Error("Unauthorized");
  }

  return res.json();
}
