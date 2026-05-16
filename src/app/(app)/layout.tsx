import { BottomTabs } from "@/components/layout/bottom-tabs";
import { OnboardingGuard } from "@/components/layout/OnboardingGuard";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { QuickAddDialog } from "@/features/transactions/components/QuickAddDialog";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGuard>
      <div className="flex h-screen overflow-hidden bg-app-radial">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar />
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-24 md:px-6 md:pb-8 pt-6">
            {children}
          </main>
        </div>
        <BottomTabs />
        <QuickAddDialog />
      </div>
    </OnboardingGuard>
  );
}
