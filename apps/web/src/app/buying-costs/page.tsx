import type { Metadata } from "next";
import { Suspense } from "react";
import { BuyingCostsCalculator } from "@/components/BuyingCostsCalculator";
import { JourneyBar } from "@/components/JourneyBar";

export const metadata: Metadata = {
  title: "Home buying costs",
  description:
    "Stamp duty, first home buyer concessions, mortgage insurance and fees for every Australian state, and the cash you need by settlement. Updated for 2026-27.",
};

export default function BuyingCostsPage() {
  return (
    <>
      <JourneyBar current="buying" />
      <Suspense>
        <BuyingCostsCalculator />
      </Suspense>
    </>
  );
}
