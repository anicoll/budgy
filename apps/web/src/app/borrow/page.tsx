import type { Metadata } from "next";
import { Suspense } from "react";
import { BorrowingCalculator } from "@/components/BorrowingCalculator";

export const metadata: Metadata = {
  title: "How much can I borrow?",
  description:
    "An estimate of what an Australian lender would lend you: take-home pay after tax, living costs, card limits and other debts, tested at your rate plus APRA's 3% buffer. Shows the range across lenders. Free and private.",
};

export default function BorrowPage() {
  return (
    <Suspense>
      <BorrowingCalculator />
    </Suspense>
  );
}
