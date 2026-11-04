import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { RefinanceCalculator } from "@/components/RefinanceCalculator";

export const metadata: Metadata = {
  title: "Refinance check",
  description:
    "Is switching home loans worth it after fees and cashback? See when a lower rate pays for itself and how far ahead you'd be. Built for Australian home loans.",
};

export default function RefinancePage() {
  return (
    <>
      <JourneyBar current="refinance" />
      <Suspense>
        <RefinanceCalculator />
      </Suspense>
    </>
  );
}
