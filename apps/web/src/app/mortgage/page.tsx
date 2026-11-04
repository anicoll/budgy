import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { MortgageCalculator } from "@/components/MortgageCalculator";

export const metadata: Metadata = {
  title: "Mortgage what-if calculator",
  description:
    "How much sooner could you own your home? Try extra repayments, offset savings, lump sums and rate changes, and see your new payoff date and interest saved. Built for Australian home loans.",
};

export default function MortgagePage() {
  return (
    <>
      <JourneyBar current="mortgage" />
      <Suspense>
        <MortgageCalculator />
      </Suspense>
    </>
  );
}
