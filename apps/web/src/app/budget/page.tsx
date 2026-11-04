import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetPlanner } from "@/components/BudgetPlanner";
import { JourneyBar } from "@/components/JourneyBar";

export const metadata: Metadata = {
  title: "Budget planner",
  description:
    "A budget that starts from your real take-home pay after tax. Enter bills weekly, monthly, quarterly or yearly and see where every dollar goes. Free, no sign-up, and private.",
};

export default function BudgetPage() {
  return (
    <>
      <JourneyBar current="budget" />
      <Suspense>
        <BudgetPlanner />
      </Suspense>
    </>
  );
}
