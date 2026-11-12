import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { RateCheckCalculator } from "@/components/RateCheckCalculator";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("rates");

export default function RateCheckPage() {
  return (
    <>
      <JsonLd data={toolJsonLd("rates")} />
      <Suspense>
        <RateCheckCalculator />
      </Suspense>
      <JourneyBar current="rates" />
    </>
  );
}
