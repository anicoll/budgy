"use client";

import { Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useUIStore } from "@/lib/state/ui-store";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function BottomTabs() {
  const pathname = usePathname();
  const setQuickAddOpen = useUIStore((s) => s.setQuickAddOpen);
  const tabs = NAV_ITEMS.filter((i) => i.mobile);

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-surface/80 backdrop-blur-xl"
    >
      <ul className="relative mx-auto grid max-w-md grid-cols-5 items-end pb-[env(safe-area-inset-bottom)]">
        {tabs.slice(0, 2).map((item) => (
          <li key={item.href}>
            <TabLink {...item} active={isActive(pathname, item.href)} />
          </li>
        ))}

        <li className="flex items-center justify-center">
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            aria-label="Quick add"
            className="-translate-y-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-accent text-primary-foreground shadow-lg ring-4 ring-background"
          >
            <Plus className="h-5 w-5" />
          </button>
        </li>

        {tabs.slice(2, 4).map((item) => (
          <li key={item.href}>
            <TabLink {...item} active={isActive(pathname, item.href)} />
          </li>
        ))}
      </ul>

      <MoreMenuRow pathname={pathname} />
    </nav>
  );
}

function TabLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof Menu;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 py-2 text-[11px] font-medium",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("h-5 w-5", active && "text-foreground")} />
      <span>{label}</span>
    </Link>
  );
}

function MoreMenuRow({ pathname }: { pathname: string | null }) {
  const secondary = NAV_ITEMS.filter((i) => !i.mobile);
  return (
    <div className="absolute right-2 top-1.5">
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="More"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:text-foreground"
          >
            <Menu className="h-4 w-4" />
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <ul className="mt-4 grid grid-cols-2 gap-2 pb-4">
            {secondary.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border border-border/60 bg-surface/60 px-3 py-3 text-sm",
                      active && "border-primary/40 bg-muted",
                    )}
                  >
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/" || pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
