"use client";

import {
  benefitAfterMonths,
  type Cents,
  compareOffers,
  compareRefinance,
  estimateLmi,
  type Frequency,
  type LoanInput,
  type RefinanceResult,
  validateRefinance,
} from "@budgy/engine";
import { useMemo, useState } from "react";
import { BenefitChart } from "@/components/BenefitChart";
import { DateField, MoneyField, NumberField, SelectField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { ResultsBar } from "@/components/ResultsBar";
import { SavedBar } from "@/components/SavedBar";
import { duration, money, moneyExact, monthYear, perPeriod } from "@/lib/format";
import {
  decodeRefinance,
  defaultRefinance,
  encodeRefinance,
  type RefinanceForm,
  toRefinanceInput,
  toRefinanceInputB,
} from "@/lib/refinance";
import { withLoanFields } from "@/lib/saved";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox } from "./ui";

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "weekly", label: "Weekly" },
];

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const pill = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm ${on ? "border-accent text-accent" : "border-border hover:border-accent"}`;

const REFINANCE_SAVED: SavedConfig<RefinanceForm> = {
  tool: "refinance",
  initial: () => defaultRefinance(),
  decode: (q) => decodeRefinance(q),
  encode: encodeRefinance,
  loan: { read: (f) => f, apply: withLoanFields },
};

export function RefinanceCalculator() {
  const saved = useSavedState(REFINANCE_SAVED);
  const { state: form, setState: setForm } = saved;
  const [copied, setCopied] = useState(false);

  const input = useMemo(() => toRefinanceInput(form), [form]);
  const errors = useMemo(() => validateRefinance(input), [input]);
  const result = useMemo(() => {
    if (errors.length) return null;
    try {
      return compareRefinance(input);
    } catch {
      return null;
    }
  }, [input, errors]);

  const inputB = useMemo(() => toRefinanceInputB(form), [form]);
  const resultB = useMemo(() => {
    if (!inputB || errors.length || validateRefinance(inputB).length) return null;
    try {
      return compareRefinance(inputB);
    } catch {
      return null;
    }
  }, [inputB, errors]);

  const set = (patch: Partial<RefinanceForm>) => setForm((f) => ({ ...f, ...patch }));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address bar still has the link */
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Refinance check</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Is switching to a lower rate worth it after fees and cashback? Enter your loan and the
          offer to see when it pays for itself. Your numbers never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className="space-y-4" aria-label="Your loan and the new offer">
          <div className={card}>
            <h2 className="mb-3 font-semibold">Your loan today</h2>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                className="col-span-2"
                label="Loan balance"
                hint="What you owe now, not the original loan."
                value={form.balance}
                onChange={(v) => v !== undefined && set({ balance: v })}
              />
              <NumberField
                label="Interest rate"
                suffix="%"
                min={0}
                max={20}
                step={0.01}
                value={form.ratePct}
                onChange={(v) => v !== undefined && set({ ratePct: v })}
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
              <SelectField
                label="Repayments"
                value={form.frequency}
                options={FREQUENCIES}
                onChange={(frequency) => set({ frequency })}
              />
              <MoneyField
                label="You pay each time"
                optional
                placeholder="Minimum"
                value={form.repayment}
                onChange={(repayment) => set({ repayment })}
              />
              {form.frequency === "fortnightly" && (
                <SelectField
                  className="col-span-2"
                  label="How your bank sets fortnightly repayments"
                  value={form.fortnightlyMethod}
                  options={[
                    { value: "half-monthly", label: "Half the monthly repayment (most common)" },
                    { value: "true", label: "True fortnightly amount" },
                  ]}
                  onChange={(fortnightlyMethod) => set({ fortnightlyMethod })}
                />
              )}
              <MoneyField
                label="Offset balance"
                hint="Assumed to move with you."
                value={form.offset}
                onChange={(v) => set({ offset: v ?? 0 })}
              />
              <MoneyField
                label="Annual fee"
                hint="Package or account fees a year."
                value={form.currentFee}
                onChange={(v) => set({ currentFee: v ?? 0 })}
              />
            </div>
          </div>

          <div className={card} style={{ borderLeft: "4px solid var(--series-a)" }}>
            <h2 className="mb-3 font-semibold">
              {form.offerB ? "Offer A: the new loan" : "The new loan"}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Interest rate"
                suffix="%"
                min={0}
                max={20}
                step={0.01}
                value={form.newRatePct}
                onChange={(v) => v !== undefined && set({ newRatePct: v })}
              />
              <NumberField
                label="Loan term"
                suffix="yrs"
                optional
                placeholder={String(form.termYears)}
                hint="Blank keeps your years left."
                min={1}
                max={40}
                step={1}
                value={form.newTermYears}
                onChange={(newTermYears) => set({ newTermYears })}
              />
              <NumberField
                label="Intro rate"
                suffix="%"
                optional
                placeholder="None"
                min={0}
                max={20}
                step={0.01}
                value={form.introRatePct}
                onChange={(introRatePct) =>
                  set({
                    introRatePct,
                    introYears: introRatePct === undefined ? undefined : (form.introYears ?? 2),
                  })
                }
              />
              {form.introRatePct !== undefined ? (
                <NumberField
                  label="For"
                  suffix="yrs"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={form.introYears}
                  hint="Then the rate above."
                  onChange={(introYears) => set({ introYears })}
                />
              ) : (
                <div />
              )}
              <MoneyField
                className="col-span-2"
                label="Annual fee"
                value={form.newFee}
                onChange={(v) => set({ newFee: v ?? 0 })}
              />
              <fieldset className="col-span-2">
                <legend className="mb-1.5 text-sm font-medium">After you switch</legend>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={pill(form.repaymentChoice === "keep")}
                    aria-pressed={form.repaymentChoice === "keep"}
                    onClick={() => set({ repaymentChoice: "keep" })}
                  >
                    Keep paying the same
                  </button>
                  <button
                    type="button"
                    className={pill(form.repaymentChoice === "minimum")}
                    aria-pressed={form.repaymentChoice === "minimum"}
                    onClick={() => set({ repaymentChoice: "minimum" })}
                  >
                    Pay the new minimum
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Keeping your repayment the same pays the loan off sooner.
                </p>
              </fieldset>
            </div>
          </div>

          {form.offerB ? (
            <div className={card} style={{ borderLeft: "4px solid var(--series-b)" }}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-semibold">Offer B</h2>
                <button
                  type="button"
                  onClick={() => set({ offerB: undefined })}
                  className="text-sm text-muted hover:text-warn"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Interest rate"
                  suffix="%"
                  min={0}
                  max={20}
                  step={0.01}
                  value={form.offerB.ratePct}
                  onChange={(v) =>
                    v !== undefined &&
                    form.offerB &&
                    set({ offerB: { ...form.offerB, ratePct: v } })
                  }
                />
                <MoneyField
                  label="Annual fee"
                  value={form.offerB.annualFee}
                  onChange={(v) =>
                    form.offerB && set({ offerB: { ...form.offerB, annualFee: v ?? 0 } })
                  }
                />
                <MoneyField
                  label="Setting up this loan"
                  hint="The cost of leaving your lender is shared with Offer A."
                  value={form.offerB.setupCosts}
                  onChange={(v) =>
                    form.offerB && set({ offerB: { ...form.offerB, setupCosts: v ?? 0 } })
                  }
                />
                <MoneyField
                  label="Cashback"
                  value={form.offerB.cashback}
                  onChange={(v) =>
                    form.offerB && set({ offerB: { ...form.offerB, cashback: v ?? 0 } })
                  }
                />
                <p className="col-span-2 text-xs text-muted">
                  Offer B uses the same loan term and repayment choice as Offer A, with no intro
                  rate.
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                set({
                  offerB: {
                    ratePct: form.newRatePct,
                    annualFee: 0,
                    setupCosts: form.setupCosts,
                    cashback: 0,
                  },
                })
              }
              className="w-full rounded-xl border border-dashed border-border p-4 text-sm font-medium text-accent hover:border-accent"
            >
              Compare a second offer
            </button>
          )}

          <div className={card}>
            <h2 className="mb-3 font-semibold">Cost to switch</h2>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                className="col-span-2"
                label="What your home is worth (optional)"
                hint="For your loan-to-value ratio. Over 80%, a new lender may charge mortgage insurance."
                optional
                value={form.homeValue}
                onChange={(homeValue) => set({ homeValue })}
              />
              <MoneyField
                label="Leaving your lender"
                hint="Discharge fee, plus break costs on a fixed rate."
                value={form.exitCosts}
                onChange={(v) => set({ exitCosts: v ?? 0 })}
              />
              <MoneyField
                label="Setting up the new loan"
                hint="Application, valuation, settlement, government fees."
                value={form.setupCosts}
                onChange={(v) => set({ setupCosts: v ?? 0 })}
              />
              <MoneyField
                label="Cashback"
                hint="Paid to you by the new lender."
                value={form.cashback}
                onChange={(v) => set({ cashback: v ?? 0 })}
              />
              <DateField
                label="Switch date"
                value={form.startDate}
                onChange={(startDate) => set({ startDate })}
              />
              <Checkbox
                className="col-span-2 flex items-center gap-2 text-sm"
                isSelected={form.addCostsToLoan}
                onChange={(v) => set({ addCostsToLoan: v })}
              >
                Add the costs to the new loan
              </Checkbox>
            </div>
          </div>
        </section>

        <section
          id="results"
          className="min-w-0 scroll-mt-4 space-y-4"
          aria-label="Results"
          aria-live="polite"
        >
          {result && (
            <LmiNote
              loan={form.balance}
              value={form.homeValue}
              onAdd={(premium) => set({ setupCosts: form.setupCosts + premium })}
            />
          )}
          {!result ? (
            <div className={`${card} text-warn`}>
              {errors.length
                ? `Check your numbers: ${errors.join("; ")}.`
                : "Something in the inputs doesn't add up."}
            </div>
          ) : (
            <Results
              r={result}
              current={input.current}
              frequency={form.frequency}
              onCopy={copyLink}
              copied={copied}
              hasIntro={form.introRatePct !== undefined}
            />
          )}
          {result && resultB && <OfferCompare a={result} b={resultB} frequency={form.frequency} />}
          <GoodToKnow tool="refinance" />
          <Method />
        </section>
      </div>

      {result && <MobileSummary r={result} />}
    </main>
  );
}

function verdict(r: RefinanceResult) {
  const m = r.breakEvenMonths;
  if (m === null) {
    return {
      good: false,
      text: (
        <>
          Switching <strong>doesn&apos;t pay for itself</strong>. You&apos;d end up{" "}
          <strong className="num text-warn">{money(-r.lifetimeBenefit)}</strong> worse off over the
          life of the loan.
        </>
      ),
    };
  }
  const when =
    m === 0 ? (
      <>
        The cashback covers the costs, so you&apos;re <strong>ahead from day one</strong>.
      </>
    ) : (
      <>
        Switching pays for itself in{" "}
        <strong>
          {m} month{m === 1 ? "" : "s"}
        </strong>{" "}
        ({monthYear(r.breakEvenDate as string)}).
      </>
    );
  return {
    good: r.lifetimeBenefit >= 0,
    text: (
      <>
        {when}{" "}
        {r.lifetimeBenefit >= 0 ? (
          <>
            Over the life of the loan you&apos;d be{" "}
            <strong className="num text-good">{money(r.lifetimeBenefit)}</strong> ahead.
          </>
        ) : (
          <>
            But over the life of the loan you&apos;d be{" "}
            <strong className="num text-warn">{money(-r.lifetimeBenefit)}</strong> behind.
          </>
        )}
      </>
    ),
  };
}

function MobileSummary({ r }: { r: RefinanceResult }) {
  const m = r.breakEvenMonths;
  return (
    <ResultsBar>
      {m === null ? (
        <strong className="text-warn">Doesn&apos;t pay off</strong>
      ) : (
        <>
          Breaks even <strong>{m === 0 ? "day one" : monthYear(r.breakEvenDate as string)}</strong>
          {r.lifetimeBenefit > 0 && (
            <>
              {" "}
              · <strong className="text-good">{money(r.lifetimeBenefit)}</strong> ahead
            </>
          )}
        </>
      )}
    </ResultsBar>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-0.5 text-lg font-semibold">{value}</div>
      {note && <div className="text-xs text-muted">{note}</div>}
    </div>
  );
}

const signed = (c: number) => (c >= 0 ? money(c) : `−${money(-c)}`);

function Results({
  r,
  current,
  frequency,
  onCopy,
  copied,
  hasIntro,
}: {
  r: RefinanceResult;
  current: LoanInput;
  frequency: Frequency;
  onCopy: () => void;
  copied: boolean;
  hasIntro: boolean;
}) {
  const [range, setRange] = useState<"5y" | "all">("5y");
  const v = verdict(r);
  const at = (years: number) => r.timeline[Math.min(years * 12, r.timeline.length - 1)].benefit;
  const points = range === "all" ? r.timeline : r.timeline.slice(0, 61);
  const daysSooner =
    (Date.parse(r.current.payoffDate) - Date.parse(r.proposed.payoffDate)) / 86_400_000;
  const change = r.repaymentChange;
  const warnings = [
    ...new Set([...r.warnings, ...r.current.warnings, ...r.proposed.warnings]),
  ].filter((w) => !/below the lender's minimum/.test(w) || r.current.warnings.includes(w));

  return (
    <>
      <div className={`${card} space-y-2 text-lg leading-relaxed`}>
        <p>{v.text}</p>
        <p className="text-base text-muted">
          {change < 0 ? (
            <>
              Your repayment drops by{" "}
              <strong className="num text-text">{moneyExact(-change)}</strong>{" "}
              {perPeriod[frequency]}
            </>
          ) : change > 0 ? (
            <>
              Your repayment rises by{" "}
              <strong className="num text-text">{moneyExact(change)}</strong> {perPeriod[frequency]}
            </>
          ) : (
            <>You keep paying {moneyExact(r.current.repayment)}</>
          )}
          {daysSooner > 15 && <>, and you&apos;re debt-free {duration(daysSooner)} sooner</>}
          {daysSooner < -15 && <>, and you&apos;re debt-free {duration(daysSooner)} later</>}.
        </p>
        {warnings.map((w) => (
          <p key={w} className="text-sm text-warn">
            {w}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Upfront cost"
          value={signed(r.netUpfrontCost)}
          note={r.netUpfrontCost < 0 ? "Cashback is more than the costs" : "After cashback"}
        />
        <Stat label="After 1 year" value={signed(at(1))} note={at(1) >= 0 ? "ahead" : "behind"} />
        <Stat label="After 5 years" value={signed(at(5))} note={at(5) >= 0 ? "ahead" : "behind"} />
        <Stat label="Interest saved" value={signed(r.interestSaved)} note="Over the loan" />
      </div>

      <div className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">How far ahead you are</h2>
          <div className="flex gap-2">
            <button type="button" className={pill(range === "5y")} onClick={() => setRange("5y")}>
              5 years
            </button>
            <button type="button" className={pill(range === "all")} onClick={() => setRange("all")}>
              Whole loan
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
            >
              {copied ? "Link copied" : "Copy link"}
            </button>
          </div>
        </div>
        <BenefitChart points={points} markerMonth={r.breakEvenMonths} />
        <p className="mt-1 text-xs text-muted">
          Interest and fees saved, less the cost to switch. Above $0 means switching has paid for
          itself.
        </p>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <h2 className="mb-3 font-semibold">Side by side</h2>
        <table className="num w-full text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1.5 pr-3 font-medium" />
              <th className="py-1.5 pr-3 text-right font-medium">Stay</th>
              <th className="py-1.5 pr-3 text-right font-medium">Switch</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td:not(:first-child)]:text-right">
            <tr>
              <td>Interest rate{hasIntro ? " (at the start)" : ""}</td>
              <td>{pct(current.annualRate)}</td>
              <td>{pct(r.proposedInput.annualRate)}</td>
            </tr>
            <tr>
              <td>Loan amount</td>
              <td>{money(current.balance)}</td>
              <td>{money(r.proposedInput.balance)}</td>
            </tr>
            <tr>
              <td>Repayment {perPeriod[frequency]}</td>
              <td>{moneyExact(r.current.repayment)}</td>
              <td>{moneyExact(r.proposed.repayment)}</td>
            </tr>
            <tr>
              <td>Debt-free</td>
              <td>{monthYear(r.current.payoffDate)}</td>
              <td>{monthYear(r.proposed.payoffDate)}</td>
            </tr>
            <tr>
              <td>Total interest</td>
              <td>{money(r.current.totalInterest)}</td>
              <td>{money(r.proposed.totalInterest)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

const pct = (rate: number) => `${(rate * 100).toFixed(2)}%`;

/** Two offers for the same loan, side by side, with the one that leaves you further ahead marked. */
function OfferCompare({
  a,
  b,
  frequency,
}: {
  a: RefinanceResult;
  b: RefinanceResult;
  frequency: Frequency;
}) {
  const [years, setYears] = useState(5);
  const c = compareOffers(a, b, years);
  const lifetime = compareOffers(a, b, 100);
  const cols = [
    { key: "a" as const, name: "Offer A", r: a, color: "var(--series-a)" },
    { key: "b" as const, name: "Offer B", r: b, color: "var(--series-b)" },
  ];
  const win = (k: "a" | "b") => c.winner === k;
  const cell = (k: "a" | "b") => (win(k) ? "font-semibold text-good" : "");
  return (
    <div className={`${card} overflow-x-auto`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Offer A or Offer B</h2>
        <div className="flex gap-2">
          {[1, 5, 10].map((y) => (
            <button
              key={y}
              type="button"
              className={pill(years === y)}
              aria-pressed={years === y}
              onClick={() => setYears(y)}
            >
              {y} {y === 1 ? "year" : "years"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-base">
        {c.winner === "tie" ? (
          <>
            After {years} {years === 1 ? "year" : "years"} the two offers are <strong>a tie</strong>
            .
          </>
        ) : (
          <>
            After {years} {years === 1 ? "year" : "years"},{" "}
            <strong>Offer {c.winner.toUpperCase()}</strong> leaves you{" "}
            <strong className="num text-good">{money(c.difference)}</strong> further ahead.
          </>
        )}
        {lifetime.winner !== c.winner && (
          <span className="text-muted">
            {" "}
            Over the whole loan the picture is{" "}
            {lifetime.winner === "tie"
              ? "a tie"
              : `different: Offer ${lifetime.winner.toUpperCase()} is ahead`}
            .
          </span>
        )}
      </p>
      <table className="num w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1.5 pr-3 font-medium" />
            {cols.map((col) => (
              <th key={col.key} className="py-1.5 pr-2 text-right font-medium">
                <span style={{ color: col.color }}>{col.name}</span>
                {win(col.key) && <span className="ml-1 text-good">Better</span>}
                {c.winner === "tie" && <span className="ml-1">Tie</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td:not(:first-child)]:text-right">
          <tr>
            <td>Interest rate</td>
            {cols.map((col) => (
              <td key={col.key}>{pct(col.r.proposedInput.annualRate)}</td>
            ))}
          </tr>
          <tr>
            <td>Upfront cost, after cashback</td>
            {cols.map((col) => (
              <td key={col.key}>{signed(col.r.netUpfrontCost)}</td>
            ))}
          </tr>
          <tr>
            <td>Repayment {perPeriod[frequency]}</td>
            {cols.map((col) => (
              <td key={col.key}>{moneyExact(col.r.proposed.repayment)}</td>
            ))}
          </tr>
          <tr>
            <td>Break-even</td>
            {cols.map((col) => (
              <td key={col.key}>
                {col.r.breakEvenMonths === null
                  ? "Never"
                  : col.r.breakEvenMonths === 0
                    ? "Day one"
                    : `${col.r.breakEvenMonths} months`}
              </td>
            ))}
          </tr>
          <tr>
            <td>
              Ahead after {years} {years === 1 ? "year" : "years"}
            </td>
            {cols.map((col) => (
              <td key={col.key} className={cell(col.key)}>
                {signed(benefitAfterMonths(col.r, years * 12))}
              </td>
            ))}
          </tr>
          <tr>
            <td>Interest saved over the loan</td>
            {cols.map((col) => (
              <td key={col.key}>{signed(col.r.interestSaved)}</td>
            ))}
          </tr>
          <tr>
            <td>Ahead over the whole loan</td>
            {cols.map((col) => (
              <td key={col.key}>{signed(col.r.lifetimeBenefit)}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        Compared on how far ahead each offer leaves you after the years you pick, counting interest
        and fees saved, switching costs and cashback. &ldquo;Ahead&rdquo; is compared with staying
        where you are.
      </p>
    </div>
  );
}

function Method() {
  return (
    <details className={`${card} text-sm`}>
      <summary className="cursor-pointer font-semibold">How this is calculated</summary>
      <div className="mt-3 space-y-2 text-muted">
        <p>
          Both loans are run side by side from the switch date, the way Australian lenders run a
          variable home loan: interest worked out daily on the balance less your offset, added
          monthly, with repayments on real calendar dates.
        </p>
        <p>
          Each month we add up the interest and fees you&apos;ve saved by switching, and take off
          the cost to switch less any cashback. The break-even date is the first month that total
          reaches $0. A lower repayment on its own isn&apos;t counted as a saving, because the money
          you didn&apos;t repay is still owed. That&apos;s why paying the new minimum can look
          better month to month but cost more over the whole loan, especially on a longer term.
        </p>
        <p>
          If you add the costs to the new loan, you pay interest on them too. An intro rate reverts
          to the ongoing rate on the date you choose, and the minimum repayment is recalculated
          then. Your current rate is assumed to stay where it is.
        </p>
        <p>
          Real offers can differ by a few dollars because of rounding and the exact day each lender
          charges interest. This is general information, not financial advice.
        </p>
      </div>
    </details>
  );
}

/**
 * A new lender charges lenders mortgage insurance when the loan is over 80%
 * of the home's value, even if you paid it with your current lender.
 */
function LmiNote({
  loan,
  value,
  onAdd,
}: {
  loan: number;
  value?: number;
  onAdd: (premium: number) => void;
}) {
  const [added, setAdded] = useState<number | null>(null);
  if (!value || value <= 0) return null;
  const lmi = estimateLmi(Math.round(value * 100) as Cents, Math.round(loan * 100) as Cents);
  if (lmi.lvr <= 0.8) return null;
  const lvr = `${(lmi.lvr * 100).toFixed(1)}%`;
  return (
    <div className="rounded-xl border border-warn/40 bg-warn/10 p-4 text-sm sm:p-5">
      <p className="font-semibold">Your loan is {lvr} of your home&apos;s value</p>
      {lmi.available ? (
        <>
          <p className="mt-1">
            Over 80%, the new lender will usually charge lenders mortgage insurance, even if you
            paid it when you bought. It could be around{" "}
            <strong className="num">{money(lmi.premium)}</strong>. That&apos;s a rough estimate: ask
            the lender for a quote.
          </p>
          {added === lmi.premium ? (
            <p className="mt-3 font-medium text-good">Added to the setup costs ✓</p>
          ) : (
            <button
              type="button"
              onClick={() => {
                onAdd(Math.round(lmi.premium / 100));
                setAdded(lmi.premium);
              }}
              className="mt-3 min-h-11 rounded-full border border-outline bg-surface px-5 font-medium text-accent hover:bg-accent hover:text-on-accent"
            >
              Add {money(lmi.premium)} to the setup costs
            </button>
          )}
        </>
      ) : (
        <p className="mt-1">
          Over 95%, most lenders won&apos;t refinance the loan. Paying it down, or a new valuation,
          may change that.
        </p>
      )}
    </div>
  );
}
