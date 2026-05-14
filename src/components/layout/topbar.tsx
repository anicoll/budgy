"use client";

import { Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/lib/state/ui-store";
import { NAV_ITEMS } from "./nav-items";
import { PeriodSwitcher } from "./period-switcher";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  ...Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i.label])),
};

export function Topbar() {
  const pathname = usePathname() ?? "/";
  const title = TITLES[pathname] ?? "Budgy";
  const setCommandOpen = useUIStore((s) => s.setCommandOpen);
  const setQuickAddOpen = useUIStore((s) => s.setQuickAddOpen);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <h1 className="text-base font-semibold tracking-tight md:text-lg">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          aria-label="Open command palette"
          className="hidden md:inline-flex h-9 items-center gap-2 rounded-md border border-border/60 bg-surface/60 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>

        <PeriodSwitcher />

        <Button
          size="sm"
          onClick={() => setQuickAddOpen(true)}
          className="hidden md:inline-flex bg-gradient-accent text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </header>
  );
}
