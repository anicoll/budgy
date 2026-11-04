import type { Metadata } from "next";
import { Suspense } from "react";
import { FixedVariableCalculator } from "@/components/FixedVariableCalculator";
import { JourneyBar } from "@/components/JourneyBar";

export const metadata: Metadata = {
  title: "Fixed or variable",
  description:
    "Should you fix your home loan, stay variable or split it? Test a path for interest rates and see what fixing all or part of your loan saves or costs. Built for Australian home loans.",
};

export default function FixedVsVariablePage() {
  return (
    <>
      <JourneyBar current="fixed" />
      <Suspense>
        <FixedVariableCalculator />
      </Suspense>
    </>
  );
}
