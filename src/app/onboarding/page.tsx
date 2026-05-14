import { Sparkles } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/page-placeholder";

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app-radial p-6">
      <PagePlaceholder
        icon={Sparkles}
        title="Welcome to Budgy"
        milestone="M5"
        description="The onboarding wizard will walk you through theme pick, first account, default category set, and a sample transaction before dropping you on the dashboard."
      />
    </div>
  );
}
