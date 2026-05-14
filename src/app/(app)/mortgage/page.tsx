import { Landmark } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function MortgagePage() {
  return (
    <PagePlaceholder
      icon={Landmark}
      title="Mortgage projector"
      milestone="M7 (Phase 2)"
      description="Loan balance, rate, repayments with offset/redraw modelling, extra repayments routed to principal / offset / redraw, rate-change scenarios, payoff timeline, and scenario comparison."
    />
  );
}
