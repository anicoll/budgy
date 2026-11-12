import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { SplitCalculator } from "@/components/SplitCalculator";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("split");

export default function SplitPage() {
  return (
    <>
      <JsonLd data={toolJsonLd("split")} />
      <Suspense>
        <SplitCalculator />
      </Suspense>
      <JourneyBar current="split" />
    </>
  );
}
