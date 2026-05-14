"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePrefs } from "@/lib/state/prefs-store";

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const onboarded = usePrefs((s) => s.onboarded);

  useEffect(() => {
    if (!onboarded) {
      router.replace("/onboarding");
    }
  }, [onboarded, router]);

  if (!onboarded) return null;
  return <>{children}</>;
}
