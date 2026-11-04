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
            href="/pay"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Pay calculator</span>
            <span className="mt-1 block text-sm text-muted">
              Your take-home pay after tax, Medicare and HELP, with overtime, salary sacrifice and
              what your pay slip will show.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/borrow"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">How much can I borrow?</span>
            <span className="mt-1 block text-sm text-muted">
              What a bank would likely lend you, tested the way lenders do, with the range across
              cautious and generous lenders.
            </span>
          </Link>
        </li>
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
        <li>
          <Link
            href="/fixed-vs-variable"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Fixed or variable</span>
            <span className="mt-1 block text-sm text-muted">
              What if rates rise 1% next year, or you fix half? Test a rate path and see what fixing
              saves or costs.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/split"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Co-borrower split</span>
            <span className="mt-1 block text-sm text-muted">
              Sharing a home loan? See what each of you pays, what extra repayments do, and who owns
              how much.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/super"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Super at retirement</span>
            <span className="mt-1 block text-sm text-muted">
              How much super will your household have, and what income could it pay? See what an
              extra $50 a week does.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/salary-sacrifice"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Salary sacrifice check</span>
            <span className="mt-1 block text-sm text-muted">
              What extra salary sacrifice really costs in take-home pay, the tax it saves, and how
              much cap room is left, for you or your whole household.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/super-or-mortgage"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Super or mortgage?</span>
            <span className="mt-1 block text-sm text-muted">
              Should spare cash go on the home loan or into super through salary sacrifice? See
              which comes out ahead, and what you can reach before retirement.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/novated-lease"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Novated lease calculator</span>
            <span className="mt-1 block text-sm text-muted">
              What a car really costs out of your pay on a novated lease, with the EV tax exemption,
              compared with a car loan or paying cash.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/pay-off-help"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Pay off HELP early?</span>
            <span className="mt-1 block text-sm text-muted">
              Should a lump sum go on your HELP debt or in your offset or savings? See what
              indexation really costs you.
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/buying-costs"
            className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
          >
            <span className="text-lg font-medium">Home buying costs</span>
            <span className="mt-1 block text-sm text-muted">
              Stamp duty, first home buyer concessions, mortgage insurance and fees in every state:
              the cash you need by settlement.
            </span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
