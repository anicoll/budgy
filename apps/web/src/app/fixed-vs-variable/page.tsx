import type { Metadata } from "next";
import { Suspense } from "react";
import { FixedVariableCalculator } from "@/components/FixedVariableCalculator";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("fixed");

export default function FixedVsVariablePage() {
  return (
    <>
      <JsonLd data={toolJsonLd("fixed")} />
      <Suspense>
        <FixedVariableCalculator />
      </Suspense>
      <JourneyBar current="fixed" />
    </>
  );
}
