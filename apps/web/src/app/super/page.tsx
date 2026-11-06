import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { SuperCalculator } from "@/components/SuperCalculator";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("super");

export default function SuperPage() {
  return (
    <>
      <JsonLd data={toolJsonLd("super")} />
      <JourneyBar current="super" />
      <Suspense>
        <SuperCalculator />
      </Suspense>
    </>
  );
}
