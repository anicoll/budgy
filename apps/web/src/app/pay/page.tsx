import type { Metadata } from "next";
import { Suspense } from "react";
import { PayCalculator } from "@/components/PayCalculator";

export const metadata: Metadata = {
  title: "Pay calculator",
  description:
    "What you take home each week, fortnight or month after tax, Medicare and HELP. Uses the ATO's current rates and withholding tables, with overtime, salary sacrifice and packaging. Free and private.",
};

export default function PayPage() {
  return (
    <Suspense>
      <PayCalculator />
    </Suspense>
  );
}
