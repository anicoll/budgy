import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { RefinanceCalculator } from "@/components/RefinanceCalculator";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("refinance");

export default function RefinancePage() {
  return (
    <>
      <JsonLd data={toolJsonLd("refinance")} />
      <Suspense>
        <RefinanceCalculator />
      </Suspense>
      <JourneyBar current="refinance" />
    </>
  );
}
