import { CreditCard } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function TransactionsPage() {
  return (
    <PagePlaceholder
      icon={CreditCard}
      title="Transactions"
      milestone="M2"
      description="Searchable, filterable, virtualised transaction table with quick-add dialog, bulk categorisation, transfer pairing, and an edit Sheet."
    />
  );
}
