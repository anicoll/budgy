import type { Metadata } from "next";
import { Suspense } from "react";
import { HelpCalculator } from "@/components/HelpCalculator";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("help");

export default function PayOffHelpPage() {
  return (
    <>
      <JsonLd data={toolJsonLd("help")} />
      <JourneyBar current="help" />
      <Suspense>
        <HelpCalculator />
      </Suspense>
    </>
  );
}
