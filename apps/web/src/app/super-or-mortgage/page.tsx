import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { SuperOrMortgage } from "@/components/SuperOrMortgage";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("super-mortgage");

export default function SuperOrMortgagePage() {
  return (
    <>
      <JsonLd data={toolJsonLd("super-mortgage")} />
      <JourneyBar current="super-mortgage" />
      <Suspense>
        <SuperOrMortgage />
      </Suspense>
    </>
  );
}
