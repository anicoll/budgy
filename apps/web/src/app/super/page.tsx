import type { Metadata } from "next";
import { Suspense } from "react";
import { SuperCalculator } from "@/components/SuperCalculator";

export const metadata: Metadata = {
  title: "Super at retirement",
  description:
    "How much super will you have at retirement, and what income could it pay? Add your whole household and every fund. Uses this year's ATO super guarantee rate and caps. Free and private.",
};

export default function SuperPage() {
  return (
    <Suspense>
      <SuperCalculator />
    </Suspense>
  );
}
