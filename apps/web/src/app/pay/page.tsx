import type { Metadata } from "next";
import { Suspense } from "react";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { PayCalculator } from "@/components/PayCalculator";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("pay");

export default function PayPage() {
  return (
    <>
      <JsonLd data={toolJsonLd("pay")} />
      <Suspense>
        <PayCalculator />
      </Suspense>
      <JourneyBar current="pay" />
    </>
  );
}
