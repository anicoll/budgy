import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function SettingsPage() {
  return (
    <PagePlaceholder
      icon={Settings}
      title="Settings"
      milestone="M5"
      description="Theme, first day of month, fortnight anchor, JSON export/import (merge or replace), load demo data, and full reset."
    />
  );
}
