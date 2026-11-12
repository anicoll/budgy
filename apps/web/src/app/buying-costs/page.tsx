import type { Metadata } from "next";
import { Suspense } from "react";
import { BuyingCostsCalculator } from "@/components/BuyingCostsCalculator";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("buying");

export default function BuyingCostsPage() {
  return (
    <>
      <JsonLd data={toolJsonLd("buying")} />
      <Suspense>
        <BuyingCostsCalculator />
      </Suspense>
      <JourneyBar current="buying" />
    </>
  );
}
