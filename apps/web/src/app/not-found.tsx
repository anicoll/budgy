import Link from "next/link";
import { LogoCoin } from "@/components/Logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-5 px-4 py-20 text-center">
      <LogoCoin size={120} />
      <h1 className="text-3xl font-bold tracking-tight">This page has rolled away</h1>
      <p className="text-muted">
        Like a nickel under the couch, it's not where we expected. The tools are all still here.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center rounded-full bg-accent px-6 font-medium text-on-accent"
      >
        Back to budgy
      </Link>
    </main>
  );
}
