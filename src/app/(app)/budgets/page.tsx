import { Wallet } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function BudgetsPage() {
  return (
    <PagePlaceholder
      icon={Wallet}
      title="Budgets"
      milestone="M3"
      description="Current-period budget view with category allocations, spend-vs-allocated progress bars, rollover toggles, unbudgeted group, and 'copy from previous period'."
    />
  );
}
