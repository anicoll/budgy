import { authClient } from "@/lib/api/connect-client";

// Re-export User shape matching existing interface consumers expect
export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  basiq_user_id?: string;
  created_at: string;
  updated_at: string;
}

function protoUserToUser(u: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  basiqUserId?: string;
  createdAt?: { toDate(): Date } | null;
  updatedAt?: { toDate(): Date } | null;
}): User {
  return {
    id: u.id,
    email: u.email,
    first_name: u.firstName,
    last_name: u.lastName,
    basiq_user_id: u.basiqUserId || undefined,
    created_at: u.createdAt ? u.createdAt.toDate().toISOString() : new Date().toISOString(),
    updated_at: u.updatedAt ? u.updatedAt.toDate().toISOString() : new Date().toISOString(),
  };
}

export async function register(req: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}): Promise<User> {
  const res = await authClient.register({
    email: req.email,
    password: req.password,
    firstName: req.first_name,
    lastName: req.last_name,
  });
  if (!res.user) throw new Error("Failed to register");
  return protoUserToUser(res.user);
}

export async function login(req: { email: string; password: string }): Promise<User> {
  const res = await authClient.login({ email: req.email, password: req.password });
  if (!res.user) throw new Error("Failed to login");
  return protoUserToUser(res.user);
}

export async function logout(): Promise<void> {
  await authClient.logout({});
}

export async function getMe(): Promise<User> {
  const res = await authClient.getMe({});
  if (!res.user) throw new Error("Unauthorized");
  return protoUserToUser(res.user);
}
