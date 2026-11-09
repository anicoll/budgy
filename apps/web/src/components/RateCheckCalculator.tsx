"use client";

import {
  type BenchmarkGap,
  checkRate,
  type LoanPurpose,
  type RateCheckResult,
  type RateType,
  type RepaymentType,
  validateRateCheck,
} from "@budgy/engine";
import { useMemo } from "react";
import { MoneyField, NumberField } from "@/components/fields";
import { SavedBar } from "@/components/SavedBar";
import { money, monthYear } from "@/lib/format";
import {
  decodeRateCheck,
  defaultRateCheck,
  encodeRateCheck,
  type RateCheckForm,
  toRateCheckInput,
} from "@/lib/rateCheck";
import { defaultRefinance, encodeRefinance } from "@/lib/refinance";
import { OWN_LINK_PARAM, withLoanFields } from "@/lib/saved";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const pill = (on: boolean) =>
  `rounded-full border px-3 py-2 text-sm ${on ? "border-accent bg-accent text-on-accent" : "border-border hover:border-accent"}`;

const RATE_CHECK_SAVED: SavedConfig<RateCheckForm> = {
  tool: "rates",
  initial: () => defaultRateCheck(),
  decode: (q) => decodeRateCheck(q),
  encode: encodeRateCheck,
  loan: { read: (f) => f, apply: withLoanFields },
};

const PURPOSES: { value: LoanPurpose; label: string }[] = [
  { value: "owner-occupier", label: "To live in" },
  { value: "investor", label: "An investment" },
];
const REPAYMENTS: { value: RepaymentType; label: string }[] = [
  { value: "principal-and-interest", label: "Principal and interest" },
  { value: "interest-only", label: "Interest only" },
];
const RATE_TYPES: { value: RateType; label: string }[] = [
  { value: "variable", label: "Variable" },
  { value: "fixed-up-to-3-years", label: "Fixed, 3 years or less" },
  { value: "fixed-over-3-years", label: "Fixed, over 3 years" },
];

const pct = (rate: number) => `${(rate * 100).toFixed(2)}%`;
const gapPct = (gap: number) => `${gap > 0 ? "+" : gap < 0 ? "−" : ""}${pct(Math.abs(gap))}`;
const signedMoney = (c: number) => (c < 0 ? `−${money(-c)}` : money(c));

export function RateCheckCalculator() {
  const saved = useSavedState(RATE_CHECK_SAVED);
  const { state: form, setState: setForm } = saved;

  const input = useMemo(() => toRateCheckInput(form), [form]);
  const errors = useMemo(() => validateRateCheck(input), [input]);
  const result = useMemo(() => {
    if (errors.length) return null;
    try {
      return checkRate(input);
    } catch {
      return null;
    }
  }, [input, errors]);

  const set = (patch: Partial<RateCheckForm>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Am I paying too much?</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Compare your home loan rate with what Australians are actually paying, from the Reserve
          Bank&apos;s monthly averages, and see what the gap costs you. Your numbers never leave
          your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="space-y-4" aria-label="Your loan">
          <div className={card}>
            <h2 className="mb-3 font-semibold">Your loan</h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                className="col-span-2"
                label="Your interest rate"
                suffix="%"
                min={0.01}
                max={20}
                step={0.01}
                value={form.ratePct}
                onChange={(v) => v !== undefined && set({ ratePct: v })}
              />
              <MoneyField
                label="Loan balance"
                value={form.balance}
                onChange={(v) => v !== undefined && set({ balance: v })}
              />
              <NumberField
                label="Years left"
                suffix="yrs"
                min={1}
                max={40}
                step={1}
                value={form.termYears}
                onChange={(v) => v !== undefined && set({ termYears: v })}
              />
            </div>
            <Pills
              legend="The home is"
              options={PURPOSES}
              value={form.purpose}
              onChange={(purpose) => set({ purpose })}
            />
            <Pills
              legend="Repayments"
              options={REPAYMENTS}
              value={form.repayment}
              onChange={(repayment) => set({ repayment })}
            />
            <Pills
              legend="Rate type"
              options={RATE_TYPES}
              value={form.rateType}
              onChange={(rateType) => set({ rateType })}
            />
          </div>
          <p className="text-sm text-muted">
            Not sure of your rate? It&apos;s on your latest statement or in your banking app,
            usually under loan details.
          </p>
        </section>

        <section
          id="results"
          className="min-w-0 scroll-mt-4 space-y-4"
          aria-label="Results"
          aria-live="polite"
        >
          {!result ? (
            <div className={`${card} text-warn`}>
              {errors.length
                ? `Check your numbers: ${errors.join("; ")}.`
                : "Something in the inputs doesn't add up."}
            </div>
          ) : (
            <Results r={result} form={form} />
          )}
        </section>
      </div>

      {result && <MobileSummary r={result} />}
    </main>
  );
}

function Pills<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="mt-4">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            className={pill(value === o.value)}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function describeLoan(form: RateCheckForm): string {
  const purpose = form.purpose === "owner-occupier" ? "Owner-occupier" : "Investment";
  if (form.repayment === "interest-only") return `${purpose}, interest only`;
  const rate = RATE_TYPES.find((r) => r.value === form.rateType)?.label.toLowerCase();
  return `${purpose}, ${rate}`;
}

function Results({ r, form }: { r: RateCheckResult; form: RateCheckForm }) {
  const n = r.newLoans;
  const interestOnly = form.repayment === "interest-only";
  const fixed = form.rateType !== "variable" && !interestOnly;
  const month = monthYear(`${r.month}-01`);

  const refinanceHref = `../refinance/?${encodeRefinance({
    ...defaultRefinance(),
    balance: form.balance,
    ratePct: form.ratePct,
    termYears: form.termYears,
    newRatePct: Math.round(n.averageRate * 10_000) / 100,
  })}&${OWN_LINK_PARAM}=1`;

  return (
    <>
      <div className={card}>
        <Headline r={r} />
        <RateScale r={r} yours={form.ratePct / 100} />
      </div>

      <div className={`grid gap-3 ${interestOnly ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        <Stat
          label={n.monthlyRepaymentGap >= 0 ? "Extra each month" : "Less each month"}
          value={money(Math.abs(n.monthlyRepaymentGap))}
          tone={n.monthlyRepaymentGap}
          note={interestOnly ? "in interest" : "in repayments"}
        />
        <Stat
          label={
            n.firstYearInterestGap >= 0 ? "Extra interest this year" : "Less interest this year"
          }
          value={money(Math.abs(n.firstYearInterestGap))}
          tone={n.firstYearInterestGap}
          note="next 12 months"
        />
        {n.lifetimeInterestGap !== null && (
          <Stat
            label="Over the rest of the loan"
            value={money(Math.abs(n.lifetimeInterestGap))}
            tone={n.lifetimeInterestGap}
            note={`${n.lifetimeInterestGap >= 0 ? "more" : "less"} interest over ${form.termYears} years`}
          />
        )}
      </div>

      <div className={card}>
        <h3 className="font-semibold">How you compare</h3>
        <p className="mb-3 text-sm text-muted">
          {describeLoan(form)}. {month}.
        </p>
        <div className="overflow-x-auto">
          <table className="num w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2 pr-2 font-medium">Compared with</th>
                <th className="px-2 py-2 text-right font-medium">Average rate</th>
                <th className="px-2 py-2 text-right font-medium">Your gap</th>
                <th className="py-2 pl-2 text-right font-medium">Cost a year</th>
              </tr>
            </thead>
            <tbody>
              <CompareRow
                label="New loans this month"
                note="what a lender offers to win you"
                g={r.newLoans}
              />
              <CompareRow
                label="All existing loans"
                note="what borrowers pay on average today"
                g={r.existingLoans}
              />
            </tbody>
          </table>
        </div>
      </div>

      {r.verdict !== "below" && (
        <div className={`${card} flex flex-wrap items-center justify-between gap-4`}>
          <div className="min-w-0 flex-[1_1_320px]">
            <h3 className="font-semibold">What to do next</h3>
            <p className="mt-1 text-sm text-muted">
              {fixed
                ? `Fixed rates usually can't change until the fixed term ends, and leaving early can mean break costs. When it ends, ask for at least ${pct(n.averageRate)}.`
                : `Call your lender and ask them to match ${pct(n.averageRate)}. If they won't, check whether switching pays for itself after fees.`}
            </p>
          </div>
          <a
            href={refinanceHref}
            className="inline-flex h-11 items-center rounded-full bg-accent px-6 font-medium text-on-accent hover:opacity-90"
          >
            Try the refinance check →
          </a>
        </div>
      )}

      <p className="text-xs text-muted">
        Averages are from the{" "}
        <a href={r.url} className="underline hover:text-text">
          Reserve Bank of Australia, Table F6 Housing Lending Rates
        </a>
        , {month}. They cover all lenders, loan sizes and deposits, and the RBA splits loans one way
        at a time, so the variable and fixed averages mix principal-and-interest with interest-only
        loans. A loan with a small deposit may sit a little above them. Repayments and interest are
        estimates on today&apos;s balance with no rate changes.
      </p>
    </>
  );
}

function Headline({ r }: { r: RateCheckResult }) {
  const n = r.newLoans;
  if (r.verdict === "above")
    return (
      <>
        <p className="text-sm font-semibold tracking-wide text-warn uppercase">Above average</p>
        <h2 className="mt-1.5 text-xl font-semibold sm:text-2xl">
          You&apos;re paying <span className="num text-warn">{pct(n.gap)} more</span> than the
          average new loan like yours.
        </h2>
        <p className="mt-2 text-muted">
          At the average new rate of {pct(n.averageRate)}, you&apos;d pay about{" "}
          <strong className="num text-text">{money(n.monthlyRepaymentGap)} a month</strong> less.
          Lenders often give existing customers a lower rate if they ask.
        </p>
      </>
    );
  if (r.verdict === "below")
    return (
      <>
        <p className="text-sm font-semibold tracking-wide text-good uppercase">Below average</p>
        <h2 className="mt-1.5 text-xl font-semibold sm:text-2xl">
          Nice. You&apos;re paying <span className="num text-good">{pct(-n.gap)} less</span> than
          the average new loan.
        </h2>
        <p className="mt-2 text-muted">
          That&apos;s worth about{" "}
          <strong className="num text-text">{money(-n.firstYearInterestGap)} a year</strong> to you.
          Check again when rates move.
        </p>
      </>
    );
  return (
    <>
      <p className="text-sm font-semibold tracking-wide text-muted uppercase">About average</p>
      <h2 className="mt-1.5 text-xl font-semibold sm:text-2xl">
        Your rate is within 0.10% of the average new loan ({pct(n.averageRate)}).
      </h2>
      <p className="mt-2 text-muted">
        You&apos;re not overpaying much, but plenty of lenders beat the average. A quick call to
        your lender may still get you a little off.
      </p>
    </>
  );
}

/** Where your rate sits against the two averages, on a scale that fits all three. */
function RateScale({ r, yours }: { r: RateCheckResult; yours: number }) {
  const newRate = r.newLoans.averageRate;
  const existing = r.existingLoans.averageRate;
  const lo = Math.floor(Math.min(yours, newRate, existing) * 200 - 1) / 200;
  const hi = Math.ceil(Math.max(yours, newRate, existing) * 200 + 1) / 200;
  const at = (rate: number) => `${((rate - lo) / (hi - lo)) * 100}%`;
  const ticks: number[] = [];
  const step = hi - lo > 0.03 ? 0.01 : 0.005;
  for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(t);
  const tone =
    r.verdict === "above" ? "var(--warn)" : r.verdict === "below" ? "var(--good)" : "var(--muted)";
  const [from, to] = yours < newRate ? [yours, newRate] : [newRate, yours];

  return (
    <div
      className="mt-6"
      role="img"
      aria-label={`Rate scale: your rate ${pct(yours)}, new loan average ${pct(newRate)}, existing loan average ${pct(existing)}`}
    >
      <div className="relative h-24 text-xs">
        <div className="absolute inset-x-0 top-8 h-2 rounded-full bg-[var(--grid)]" />
        <div
          className="absolute top-8 h-2 opacity-35"
          style={{ left: at(from), width: `calc(${at(to)} - ${at(from)})`, background: tone }}
        />
        <Marker left={at(newRate)} label="New loans" value={pct(newRate)} row={0} />
        <Marker left={at(existing)} label="Existing" value={pct(existing)} row={1} />
        <div
          className="absolute top-1 -translate-x-1/2 whitespace-nowrap"
          style={{ left: at(yours), color: tone }}
        >
          You <strong className="num text-sm">{pct(yours)}</strong>
        </div>
        <div
          className="absolute top-[26px] -ml-2.5 h-5 w-5 rounded-full border-[3px] border-surface"
          style={{ left: at(yours), background: tone }}
        />
      </div>
      <div className="relative mt-1 h-4 text-xs text-muted">
        {ticks.map((t) => (
          <span key={t} className="num absolute -translate-x-1/2" style={{ left: at(t) }}>
            {(t * 100).toFixed(step < 0.01 ? 1 : 0)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function Marker({
  left,
  label,
  value,
  row,
}: {
  left: string;
  label: string;
  value: string;
  row: 0 | 1;
}) {
  return (
    <>
      <div className="absolute top-7 h-4 w-0.5 bg-muted" style={{ left }} />
      <div
        className={`absolute -translate-x-1/2 whitespace-nowrap text-muted ${row === 0 ? "top-12" : "top-[68px]"}`}
        style={{ left }}
      >
        {label} <strong className="num text-text">{value}</strong>
      </div>
    </>
  );
}

function CompareRow({ label, note, g }: { label: string; note: string; g: BenchmarkGap }) {
  const tone = g.gap > 0 ? "text-warn" : g.gap < 0 ? "text-good" : "";
  return (
    <tr className="border-t border-border">
      <td className="py-2.5 pr-2">
        {label}
        <div className="text-xs text-muted">{note}</div>
      </td>
      <td className="px-2 py-2.5 text-right">{pct(g.averageRate)}</td>
      <td className={`px-2 py-2.5 text-right ${tone}`}>{gapPct(g.gap)}</td>
      <td className="py-2.5 pl-2 text-right">{signedMoney(g.firstYearInterestGap)}</td>
    </tr>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`num mt-0.5 text-xl font-semibold ${tone < 0 ? "text-good" : ""}`}>
        {value}
      </div>
      {note && <div className="text-xs text-muted">{note}</div>}
    </div>
  );
}

function MobileSummary({ r }: { r: RateCheckResult }) {
  const gap = r.newLoans.gap;
  return (
    <a
      href="#results"
      className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 text-sm backdrop-blur lg:hidden"
    >
      <span className="num min-w-0">
        {r.verdict === "about" ? (
          <strong>About average</strong>
        ) : (
          <>
            <strong className={gap > 0 ? "text-warn" : "text-good"}>
              {pct(Math.abs(gap))} {gap > 0 ? "above" : "below"}
            </strong>{" "}
            average
          </>
        )}
      </span>
      <span className="shrink-0 text-accent">See results ↓</span>
    </a>
  );
}
