"use client";

import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/useAuth";
import { usePrefs } from "@/lib/state/prefs-store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { checkSession, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = usePrefs((s) => s._hydrated);
  const storageMode = usePrefs((s) => s.storageMode) || "online";
  const isOnline = storageMode === "online";

  useEffect(() => {
    if (isOnline) {
      checkSession();
    }
  }, [isOnline, checkSession]);

  useEffect(() => {
    if (!isOnline) return;

    if (!isLoading && !isAuthenticated) {
      if (pathname !== "/login" && pathname !== "/register") {
        router.push("/login");
      }
    }
  }, [isOnline, isLoading, isAuthenticated, pathname, router]);

  if (!hydrated || (isOnline && isLoading && pathname !== "/login" && pathname !== "/register")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
