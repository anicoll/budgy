"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePrefs } from "@/lib/state/prefs-store";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const onboarded = usePrefs((s) => s.onboarded);
  const hydrated = usePrefs((s) => s._hydrated);

  useEffect(() => {
    if (hydrated && !onboarded) {
      router.replace("/onboarding");
    }
  }, [hydrated, onboarded, router]);

  // Don't render until persisted state is loaded — prevents flash redirect
  if (!hydrated) return null;
  if (!onboarded) return null;
  return <>{children}</>;
}
