import type { Metadata } from "next";
import { Suspense } from "react";
import { HelpCalculator } from "@/components/HelpCalculator";

export const metadata: Metadata = {
  title: "Pay off HELP early?",
  description:
    "Should you make a voluntary HELP repayment or keep the money in your offset or savings? Uses the ATO's indexation rates and repayment thresholds. Free and private.",
};

export default function PayOffHelpPage() {
  return (
    <Suspense>
      <HelpCalculator />
    </Suspense>
  );
}
