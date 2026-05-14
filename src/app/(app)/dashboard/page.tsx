import { Home } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function DashboardPage() {
  return (
    <PagePlaceholder
      icon={Home}
      title="Dashboard"
      milestone="M4"
      description="KPI cards (net worth, period income, spend, savings rate), net-worth area chart, cashflow bar chart, category-spend donut, recent transactions, and an account strip with sparklines. Charts wired to ApexCharts."
    />
  );
}
