import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetPlanner } from "@/components/BudgetPlanner";

export const metadata: Metadata = {
  title: "Budget planner",
  description:
    "A budget that starts from your real take-home pay after tax. Enter bills weekly, monthly, quarterly or yearly and see where every dollar goes. Free, no sign-up, and private.",
};

export default function BudgetPage() {
  return (
    <Suspense>
      <BudgetPlanner />
    </Suspense>
  );
}
