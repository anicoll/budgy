import type { Metadata } from "next";
import { Suspense } from "react";
import { BudgetPlanner } from "@/components/BudgetPlanner";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("budget");

export default function BudgetPage() {
  return (
    <>
      <JsonLd data={toolJsonLd("budget")} />
      <Suspense>
        <BudgetPlanner />
      </Suspense>
      <JourneyBar current="budget" />
    </>
  );
}
