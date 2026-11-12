import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { SacrificeCalculator } from "@/components/SacrificeCalculator";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("sacrifice");

export default function SalarySacrificePage() {
  return (
    <>
      <JsonLd data={toolJsonLd("sacrifice")} />
      <Suspense>
        <SacrificeCalculator />
      </Suspense>
      <JourneyBar current="sacrifice" />
    </>
  );
}
