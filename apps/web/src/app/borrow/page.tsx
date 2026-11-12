import type { Metadata } from "next";
import { Suspense } from "react";
import { BorrowingCalculator } from "@/components/BorrowingCalculator";
import { JourneyBar } from "@/components/JourneyBar";
import { JsonLd } from "@/components/JsonLd";
import { toolJsonLd, toolMetadata } from "@/lib/seo";

export const metadata: Metadata = toolMetadata("borrow");

export default function BorrowPage() {
  return (
    <>
      <JsonLd data={toolJsonLd("borrow")} />
      <Suspense>
        <BorrowingCalculator />
      </Suspense>
      <JourneyBar current="borrow" />
    </>
  );
}
