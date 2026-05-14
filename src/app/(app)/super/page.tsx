import { PiggyBank } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function SuperPage() {
  return (
    <PagePlaceholder
      icon={PiggyBank}
      title="Super projector"
      milestone="M6 (Phase 2)"
      description="Current balance + employer SG + voluntary contributions, with return / inflation / fee assumptions, projected to retirement age. Concessional and non-concessional cap warnings using AU FY tables."
    />
  );
}
