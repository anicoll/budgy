import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { SplitCalculator } from "@/components/SplitCalculator";

export const metadata: Metadata = {
  title: "Co-borrower split",
  description:
    "Sharing a home loan? Split it by share, see what each borrower pays, what extra repayments do for the person who makes them, and who owns how much. Free and private, built for Australian home loans.",
};

export default function SplitPage() {
  return (
    <>
      <JourneyBar current="split" />
      <Suspense>
        <SplitCalculator />
      </Suspense>
    </>
  );
}
