"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/lib/state/ui-store";
import { cn } from "@/lib/utils";
import { APP_MARK_ICON, APP_NAME, NAV_ITEMS } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  const AppMark = APP_MARK_ICON;

  return (
    <aside
      className={cn(
        "relative hidden md:flex shrink-0 flex-col gap-2 border-r border-border/60 bg-surface/40 backdrop-blur-xl px-3 py-4 transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-[232px]",
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-accent text-primary-foreground shadow-md">
          <AppMark className="h-5 w-5" />
        </span>
        {!collapsed && <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>}
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.filter((i) => i.group === "primary").map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}

        <div className="my-3 h-px bg-border/60" />

        {NAV_ITEMS.filter((i) => i.group === "secondary").map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-1 px-1">
        <ThemeToggle />
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof APP_MARK_ICON;
  active: boolean;
  collapsed: boolean;
}) {
  const content = (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {active && (
        <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-gradient-accent" />
      )}
    </Link>
  );
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return content;
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
