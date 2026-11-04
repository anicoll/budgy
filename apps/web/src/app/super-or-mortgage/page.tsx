import type { Metadata } from "next";
import { Suspense } from "react";
import { SuperOrMortgage } from "@/components/SuperOrMortgage";

export const metadata: Metadata = {
  title: "Super or mortgage?",
  description:
    "Should spare cash go on the home loan or into super through salary sacrifice? Compare both for your whole household, at retirement and every year before. Uses this year's ATO tax and super rules. Free and private.",
};

export default function SuperOrMortgagePage() {
  return (
    <Suspense>
      <SuperOrMortgage />
    </Suspense>
  );
}
