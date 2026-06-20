"use client";

import { useAuth } from "@/features/auth/useAuth";
import { usePrefs } from "@/lib/state/prefs-store";

/** True when online API queries may run (offline mode, or authenticated session ready). */
export function useOnlineQueryEnabled(): boolean {
  const hydrated = usePrefs((s) => s._hydrated);
  const storageMode = usePrefs((s) => s.storageMode) || "online";
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const isLoading = useAuth((s) => s.isLoading);

  if (!hydrated) return false;
  if (storageMode === "offline") return true;
  return isAuthenticated && !isLoading;
}
