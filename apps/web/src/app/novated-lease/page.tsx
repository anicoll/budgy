import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaseCalculator } from "@/components/LeaseCalculator";

export const metadata: Metadata = {
  title: "Novated lease calculator",
  description:
    "What a novated lease really costs out of your pay, with the EV FBT exemption, GST savings and the employee contribution method, compared with a car loan or paying cash. Uses the ATO's current rates. Free and private.",
};

export default function NovatedLeasePage() {
  return (
    <Suspense>
      <LeaseCalculator />
    </Suspense>
  );
}
