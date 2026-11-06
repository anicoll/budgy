"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { HomeIcon, IdeasIcon, SettingsIcon, ToolsIcon } from "@/components/Icons";
import { LogoMark } from "@/components/Logo";
import { HOME_HREF, type HomeView, SAVED_CHANGED, viewParam } from "@/lib/nav";
import { readSaved } from "@/lib/saved";
import { AREAS, TOOLS } from "@/lib/tools";

/** Which home view, if any, the current page is. */
function useActiveView(): HomeView | null {
  const path = usePathname();
  const params = useSearchParams();
  const home = path === "/" || path === "";
  return home ? (viewParam(params.get("view")) ?? "dashboard") : null;
}

const trim = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);

function Brand({ size = 30 }: { size?: number }) {
  return (
    <Link
      href="/"
      aria-label="budgy home"
      className="inline-flex min-h-11 items-center gap-2.5 text-[22px] font-bold tracking-tight text-[#0e5561] dark:text-accent"
    >
      <LogoMark size={size} />
      <span aria-hidden="true">budgy</span>
    </Link>
  );
}

/**
 * The side menu on wide screens: the home views, then every tool by area.
 * Reading ?view= opts out of static rendering, so the exported HTML gets the
 * same menu with no home view marked, and crawlers still see every tool link.
 */
export function SideNav() {
  return (
    <Suspense fallback={<SideMenu active={null} />}>
      <LiveSideMenu />
    </Suspense>
  );
}

function LiveSideMenu() {
  return <SideMenu active={useActiveView()} />;
}

function SideMenu({ active }: { active: HomeView | null }) {
  const path = trim(usePathname());
  const [remembering, setRemembering] = useState(true);

  useEffect(() => {
    const load = () => setRemembering(readSaved().remember);
    load();
    window.addEventListener("storage", load);
    window.addEventListener(SAVED_CHANGED, load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener(SAVED_CHANGED, load);
    };
  }, []);

  // Tool links are a little tighter so the whole menu fits on a laptop screen.
  const row = (on: boolean, tight = false) =>
    `flex items-center gap-3 rounded-full px-4 ${tight ? "min-h-9 text-[13.5px]" : "min-h-11 text-[14px]"} ${
      on
        ? "bg-primary-container font-semibold text-on-primary-container"
        : "text-muted hover:bg-surface-container-high hover:text-text"
    }`;

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto bg-surface-container px-3 py-4 lg:flex">
      <div className="mb-3 px-3">
        <Brand />
      </div>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        <Link
          href={HOME_HREF.dashboard}
          aria-current={active === "dashboard" ? "page" : undefined}
          className={row(active === "dashboard")}
        >
          <HomeIcon size={20} />
          Dashboard
        </Link>
        <Link
          href={HOME_HREF.ideas}
          aria-current={active === "ideas" ? "page" : undefined}
          className={row(active === "ideas")}
        >
          <IdeasIcon size={20} />
          Ideas
        </Link>
        <Link
          href={HOME_HREF.tools}
          aria-current={active === "tools" ? "page" : undefined}
          className={row(active === "tools")}
        >
          <ToolsIcon size={20} />
          All tools
        </Link>
        <Link
          href={HOME_HREF.settings}
          aria-current={active === "settings" ? "page" : undefined}
          className={row(active === "settings")}
        >
          <SettingsIcon size={20} />
          Settings and your answers
        </Link>
        {AREAS.map((a) => (
          <div key={a.area} className="flex flex-col gap-0.5">
            <p className="mx-4 mt-4 mb-1 text-xs font-semibold text-muted">{a.name}</p>
            {TOOLS.filter((t) => t.area === a.area).map((t) => (
              <Link
                key={t.key}
                href={`${t.href}/`}
                aria-current={path === t.href ? "page" : undefined}
                className={row(path === t.href, true)}
              >
                {t.name}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <p className="mt-auto px-4 pt-4 text-xs text-muted">
        {remembering ? "Saved on this device only" : "Free, no sign-up"}
      </p>
    </aside>
  );
}

/** The slim bar at the top on phones. Sets --header-h so sticky bars sit under it. */
export function TopBar() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Hidden on wide screens, where it measures 0 and sticky bars go to the top.
    const set = () =>
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      className="sticky top-0 z-40 border-b border-border bg-bg/95 backdrop-blur lg:hidden"
    >
      <div className="flex items-center px-4 py-1.5">
        <Brand size={28} />
      </div>
    </header>
  );
}

const TABS: { view: HomeView; label: string; Icon: (p: { size?: number }) => React.ReactNode }[] = [
  { view: "dashboard", label: "Home", Icon: HomeIcon },
  { view: "tools", label: "Tools", Icon: ToolsIcon },
  { view: "ideas", label: "Ideas", Icon: IdeasIcon },
  { view: "settings", label: "Settings", Icon: SettingsIcon },
];

/** The tab bar at the bottom on phones. A tool page counts as Tools. */
export function BottomNav() {
  return (
    <Suspense fallback={<TabBar active={null} />}>
      <LiveTabBar />
    </Suspense>
  );
}

function LiveTabBar() {
  return <TabBar active={useActiveView() ?? "tools"} />;
}

function TabBar({ active }: { active: HomeView | null }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid h-[var(--bottom-nav-h)] grid-cols-4 border-t border-border bg-surface-container pt-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS.map(({ view, label, Icon }) => {
        const on = view === active;
        return (
          <Link
            key={view}
            href={HOME_HREF[view]}
            aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center gap-1 text-xs ${
              on ? "font-semibold text-text" : "text-muted"
            }`}
          >
            <span
              className={`flex h-8 w-16 items-center justify-center rounded-full ${
                on ? "bg-primary-container text-on-primary-container" : ""
              }`}
            >
              <Icon size={22} />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
