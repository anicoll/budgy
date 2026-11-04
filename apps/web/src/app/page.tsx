import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Free money tools for Australians
      </h1>
      <p className="mt-3 max-w-xl text-muted">
        Fast, accurate calculators with no sign-up. Your numbers never leave your device.
      </p>
      <ul className="mt-10 grid gap-4">
        <li>
          <Link
            href="/mortgage"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Mortgage what-if</span>
            <span className="mt-1 block text-sm text-muted">
              See how extra repayments, your offset, lump sums or a rate change move your payoff
              date and interest.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/debt"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Debt payoff planner</span>
            <span className="mt-1 block text-sm text-muted">
              Credit cards, car and personal loans: see which to pay first and when you&apos;ll be
              debt-free.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/refinance"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Refinance check</span>
            <span className="mt-1 block text-sm text-muted">
              Is switching to a lower rate worth it after fees and cashback? See when it pays for
              itself.
            </span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
