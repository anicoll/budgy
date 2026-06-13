"use client";

import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect } from "react";
import { useAuth } from "@/features/auth/useAuth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { checkSession, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const useBackend = process.env.NEXT_PUBLIC_USE_BACKEND === "true";

  useEffect(() => {
    if (useBackend) {
      checkSession();
    }
  }, [useBackend, checkSession]);

  useEffect(() => {
    if (!useBackend) return;

    if (!isLoading && !isAuthenticated) {
      if (pathname !== "/login" && pathname !== "/register") {
        router.push("/login");
      }
    }
  }, [useBackend, isLoading, isAuthenticated, pathname, router]);

  if (useBackend && isLoading && pathname !== "/login" && pathname !== "/register") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
