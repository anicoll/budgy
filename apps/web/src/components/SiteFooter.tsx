import Link from "next/link";
import { LogoMark } from "@/components/Logo";

/** The footer under every page: the mark, the tagline and whose project it is. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-[13px] text-muted sm:px-6">
        <LogoMark size={22} />
        <span className="text-[15px] font-bold tracking-tight text-text">budgy</span>
        <span>Every nickel counts.</span>
        <Link href="/privacy/" className="text-accent hover:underline">
          Privacy
        </Link>
        <span className="sm:ml-auto">
          A <span className="text-tertiary">nicoll.dev</span> project
        </span>
        <p className="w-full">
          General information only, not financial advice. For advice about your situation, talk to a
          licensed financial adviser.
        </p>
      </div>
    </footer>
  );
}
