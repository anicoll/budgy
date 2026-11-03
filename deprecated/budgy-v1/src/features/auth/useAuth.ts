"use client";

import { create } from "zustand";
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  getMe,
  type User,
} from "@/lib/api/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (req: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      await apiLogin({ email, password });
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to log in";
      set({ user: null, isAuthenticated: false, error: errorMsg, isLoading: false });
      throw err;
    }
  },

  register: async (req) => {
    set({ isLoading: true, error: null });
    try {
      await apiRegister(req);
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to register";
      set({ user: null, isAuthenticated: false, error: errorMsg, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiLogout();
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to log out";
      set({ error: errorMsg, isLoading: false });
      throw err;
    }
  },

  checkSession: async () => {
    set({ isLoading: true, error: null });
    try {
      const user = await getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (_err) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
