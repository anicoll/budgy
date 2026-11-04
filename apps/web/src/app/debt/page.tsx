import type { Metadata } from "next";
import { Suspense } from "react";
import { DebtPlanner } from "@/components/DebtPlanner";
import { JourneyBar } from "@/components/JourneyBar";

export const metadata: Metadata = {
  title: "Debt payoff planner",
  description:
    "Credit cards, car and personal loans: see which debt to pay first, compare avalanche and snowball, and find your debt-free date. Free, private, built for Australians.",
};

export default function DebtPage() {
  return (
    <>
      <JourneyBar current="debt" />
      <Suspense>
        <DebtPlanner />
      </Suspense>
    </>
  );
}
