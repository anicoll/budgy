"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/Logo";
import { parseProfile } from "@/lib/profile";
import { readSaved } from "@/lib/saved";

/** Fired on this page when the home page answers change, so the header can catch up. */
export const SAVED_CHANGED = "budgy:saved-changed";

export type HomeView = "dashboard" | "all" | "answers";

/** Where each part of the home page lives. Links work from any page, under any base path. */
export const HOME_HREF: Record<HomeView, string> = {
  dashboard: "/",
  all: "/?view=all",
  answers: "/?view=answers",
};

/** The home page view a `?view=` value asks for, or null for the default. */
export function viewParam(value: string | null): Exclude<HomeView, "dashboard"> | null {
  return value === "all" || value === "answers" ? value : null;
}

/** The site header, anchored at the top of every page. */
export function SiteHeader() {
  const path = usePathname();
  const params = useSearchParams();
  const [hasProfile, setHasProfile] = useState(false);
  const [remembering, setRemembering] = useState(true);
  const ref = useRef<HTMLElement>(null);

  // Let sticky bars on the page sit just under the header, however tall it wraps.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () =>
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const load = () => {
      const data = readSaved();
      setHasProfile(parseProfile(data.profile) !== null);
      setRemembering(data.remember);
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener(SAVED_CHANGED, load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener(SAVED_CHANGED, load);
    };
  }, []);

  const home = path === "/" || path === "";
  const asked = viewParam(params.get("view"));
  const active: HomeView | null = home ? (asked ?? "dashboard") : null;
  const item = (view: HomeView, label: string) => (
    <Link
      href={HOME_HREF[view]}
      aria-current={active === view ? "page" : undefined}
      className={`inline-flex min-h-11 items-center text-[15px] ${
        active === view ? "font-semibold text-text" : "text-muted hover:text-text"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header
      ref={ref}
      className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-0 px-4 py-1.5 sm:px-6">
        <Link
          href="/"
          aria-label="budgy home"
          className="inline-flex min-h-11 items-center gap-2.5 text-[22px] font-bold tracking-tight text-[#0e5561] dark:text-accent"
        >
          <LogoMark size={30} />
          <span aria-hidden="true">budgy</span>
        </Link>
        <nav aria-label="Main" className="flex flex-wrap gap-x-5">
          {hasProfile && item("dashboard", "My dashboard")}
          {item("all", "All tools")}
          {hasProfile && item("answers", "My answers")}
        </nav>
        <span className="ml-auto hidden text-[13px] text-muted sm:inline">
          {remembering ? "Saved on this device only" : "Free, no sign-up"}
        </span>
      </div>
    </header>
  );
}
