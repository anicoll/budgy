import { LayoutGrid } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function AccountsPage() {
  return (
    <PagePlaceholder
      icon={LayoutGrid}
      title="Accounts"
      milestone="M1"
      description="Cards grouped by type (cash, credit, investment, loan, super) with drag-to-reorder, archive, and a type-aware add/edit drawer."
    />
  );
}
