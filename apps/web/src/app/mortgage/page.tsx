import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { MortgageCalculator } from "@/components/MortgageCalculator";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("mortgage");

export default function MortgagePage() {
  return (
    <>
      <JsonLd data={toolJsonLd("mortgage")} />
      <JourneyBar current="mortgage" />
      <Suspense>
        <MortgageCalculator />
      </Suspense>
    </>
  );
}
