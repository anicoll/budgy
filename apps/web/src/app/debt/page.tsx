import type { Metadata } from "next";
import { Suspense } from "react";
import { DebtPlanner } from "@/components/DebtPlanner";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("debt");

export default function DebtPage() {
  return (
    <>
      <JsonLd data={toolJsonLd("debt")} />
      <Suspense>
        <DebtPlanner />
      </Suspense>
      <JourneyBar current="debt" />
    </>
  );
}
