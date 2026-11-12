import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { LeaseCalculator } from "@/components/LeaseCalculator";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("lease");

export default function NovatedLeasePage() {
  return (
    <>
      <JsonLd data={toolJsonLd("lease")} />
      <Suspense>
        <LeaseCalculator />
      </Suspense>
      <JourneyBar current="lease" />
    </>
  );
}
