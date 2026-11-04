import type { Metadata } from "next";
import { Suspense } from "react";
import { SacrificeCalculator } from "@/components/SacrificeCalculator";

export const metadata: Metadata = {
  title: "Salary sacrifice check",
  description:
    "How much extra super salary sacrifice really costs in take-home pay, the tax it saves and the cap room left, for one person or a whole household. Uses the ATO's current rates. Free and private.",
};

export default function SalarySacrificePage() {
  return (
    <Suspense>
      <SacrificeCalculator />
    </Suspense>
  );
}
