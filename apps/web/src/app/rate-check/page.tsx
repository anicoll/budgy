import type { Metadata } from "next";
import { Suspense } from "react";
import { RateCheckCalculator } from "@/components/RateCheckCalculator";

export const metadata: Metadata = {
  title: "Am I paying too much? Home loan rate check",
  description:
    "Compare your home loan rate with the Reserve Bank's average rates for new and existing loans, and see what the gap costs you each month and over the loan.",
};

export default function RateCheckPage() {
  return (
    <Suspense>
      <RateCheckCalculator />
    </Suspense>
  );
}
