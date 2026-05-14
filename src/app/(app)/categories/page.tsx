import { Tag } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function CategoriesPage() {
  return (
    <PagePlaceholder
      icon={Tag}
      title="Categories"
      milestone="M2"
      description="Income and expense category trees (single-level nesting) with inline rename, colour and icon picker, and soft-archive."
    />
  );
}
