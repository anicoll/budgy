"use client";

import {
  compareHelpEarly,
  HELP_INDEXATION,
  HELP_INDEXATION_SOURCE,
  type HelpEarlyResult,
  type HelpScenario,
  validateHelpEarly,
} from "@budgy/engine";
import { useMemo } from "react";
import { BalanceChart, type Series } from "@/components/BalanceChart";
import { MoneyField, NumberField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { NextSteps } from "@/components/NextSteps";
import {
  AnswerCard,
  AnswerRow,
  Detail,
  Disclosure,
  ToolHeader,
  ToolPage,
  ToolSection,
} from "@/components/tool";
import { money } from "@/lib/format";
import { decodeHelp, defaultHelp, encodeHelp, type HelpForm, toHelpInput } from "@/lib/helpState";
import { HELP_PEOPLE } from "@/lib/household";
import { today } from "@/lib/state";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const seg = (on: boolean) =>
  `min-h-11 flex-1 px-3 text-sm font-medium transition ${on ? "bg-accent text-on-accent" : "bg-surface hover:text-accent"}`;
const pct = (r: number, dp = 2) => `${(r * 100).toFixed(dp)}%`;

const HELP_SAVED: SavedConfig<HelpForm> = {
  tool: "help",
  initial: () => defaultHelp(),
  decode: (q) => decodeHelp(q),
  encode: encodeHelp,
  people: HELP_PEOPLE,
};

const LAST_KNOWN = HELP_INDEXATION[HELP_INDEXATION.length - 1];

export function HelpCalculator() {
  const saved = useSavedState(HELP_SAVED);
  const { state: form, setState: setForm } = saved;

  const input = useMemo(() => toHelpInput(form), [form]);
  const errors = useMemo(() => validateHelpEarly(input), [input]);
  const result = useMemo(() => {
    if (errors.length) return null;
    try {
      return compareHelpEarly(input);
    } catch {
      return null;
    }
  }, [input, errors]);

  const set = (patch: Partial<HelpForm>) => setForm((f) => ({ ...f, ...patch }));
  const offset = form.alternative === "offset";

  return (
    <ToolPage>
      <ToolHeader
        title="Pay off HELP early?"
        intro="Whether a lump sum does more on your HELP debt or in your offset or savings."
        saved={saved}
      />

      <div className="space-y-8" aria-live="polite">
        {!result ? (
          <div className={`${card} text-warn`}>
            {errors.length
              ? `Check your numbers: ${errors.join(" ")}`
              : "Something in the inputs doesn't add up."}
          </div>
        ) : (
          <Results r={result} form={form} />
        )}

        <ToolSection id="numbers-h" title="Your numbers">
          <div className={`${card} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
            <MoneyField
              label="HELP balance"
              hint="From myGov, after your last tax return."
              value={form.balance}
              onChange={(v) => v !== undefined && set({ balance: v })}
            />
            <MoneyField
              label="Income this year"
              hint={
                result && result.compulsoryThisYear > 0
                  ? `Compulsory repayment: ${money(result.compulsoryThisYear)} a year (${money(result.compulsoryThisYear / 26)} a fortnight).`
                  : "Repayment income: taxable income plus fringe benefits and super you sacrifice."
              }
              value={form.income}
              onChange={(v) => v !== undefined && set({ income: v })}
            />
            <MoneyField
              label="Lump sum you could pay"
              value={form.lumpSum}
              onChange={(v) => set({ lumpSum: v ?? 0 })}
            />
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Otherwise the money goes into</legend>
              <div className="flex overflow-hidden rounded-lg border border-border">
                <button
                  type="button"
                  className={seg(offset)}
                  aria-pressed={offset}
                  onClick={() => set({ alternative: "offset" })}
                >
                  Offset or mortgage
                </button>
                <button
                  type="button"
                  className={seg(!offset)}
                  aria-pressed={!offset}
                  onClick={() => set({ alternative: "savings" })}
                >
                  Savings account
                </button>
              </div>
            </fieldset>
            <NumberField
              label={offset ? "Home loan rate" : "Savings rate, before tax"}
              suffix="%"
              min={0}
              max={30}
              step={0.05}
              value={form.ratePct}
              hint={
                offset
                  ? "Offset savings aren't taxed."
                  : result
                    ? `Taxed at ${pct(result.taxRate, 0)}${form.taxRatePct === undefined ? ", worked out from your income" : ""}.`
                    : undefined
              }
              onChange={(v) => v !== undefined && set({ ratePct: v })}
            />
          </div>
          <details className={card}>
            <summary className="min-h-7 cursor-pointer text-sm font-medium">Assumptions</summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <NumberField
                label="Future indexation"
                suffix="%"
                min={-5}
                max={20}
                step={0.1}
                value={form.indexationPct}
                hint={`On 1 June ${LAST_KNOWN.year} it was ${pct(LAST_KNOWN.rate, 1)}. Used for each 1 June the ATO hasn't announced yet.`}
                onChange={(v) => v !== undefined && set({ indexationPct: v })}
              />
              <NumberField
                label="Income growth"
                suffix="%"
                min={-10}
                max={20}
                step={0.5}
                value={form.incomeGrowthPct}
                onChange={(v) => v !== undefined && set({ incomeGrowthPct: v })}
              />
              {!offset && (
                <NumberField
                  label="Tax on interest"
                  suffix="%"
                  optional
                  placeholder="Auto"
                  min={0}
                  max={60}
                  step={1}
                  value={form.taxRatePct}
                  onChange={(taxRatePct) => set({ taxRatePct })}
                />
              )}
            </div>
          </details>
        </ToolSection>

        <Detail>
          {result && result.payNow.paidNow > 0 && (
            <Disclosure title="Year by year" hint="indexation, repayments and balances">
              <YearByYear r={result} />
            </Disclosure>
          )}
          <Disclosure title="Good to know" hint="tips and things to check">
            <GoodToKnow tool="help" bare extra={result ? tips(result) : []} />
          </Disclosure>
          <Disclosure title="How this is calculated" hint="indexation and repayments">
            <Method />
          </Disclosure>
        </Detail>
        <NextSteps tool="help" className="pt-2" />
      </div>
    </ToolPage>
  );
}

function tips(r: HelpEarlyResult): React.ReactNode[] {
  const nextJune = r.keep.years.find((y) => y.indexationDate)?.indexationDate;
  return [
    r.warnings.some((w) => w.kind === "never-repaid") && (
      <span className="text-warn">
        At this income your debt may never be repaid in full. HELP is cancelled on death, so paying
        it early may not be worth it at all.
      </span>
    ),
    r.warnings.some((w) => w.kind === "below-threshold") && (
      <>Your income is below the repayment threshold, so nothing is taken from your pay.</>
    ),
    ...r.warnings.map(
      (w) =>
        w.kind === "lump-sum-capped" && (
          <>Only the {money(w.balance)} you owe can go on the loan.</>
        ),
    ),
    <>
      Paying early doesn&apos;t lower your compulsory repayments. They&apos;re set by income until
      the debt is gone
      {r.compulsoryThisYear > 0
        ? `, then the ${money(r.compulsoryThisYear)} a year stays in your pay.`
        : "."}
    </>,
    nextJune && (
      <>
        If you do pay, get it to the ATO before {longDate(nextJune)} to skip that year&apos;s
        indexation. BPAY can take a few days.
      </>
    ),
  ].filter(Boolean);
}

function Results({ r, form }: { r: HelpEarlyResult; form: HelpForm }) {
  const paid = r.payNow.paidNow;
  const offset = form.alternative === "offset";
  const where = offset ? "your offset" : "savings";
  const lastKeep = r.keep.years[r.keep.years.length - 1];
  const lastPay = r.payNow.years[r.payNow.years.length - 1];

  if (paid === 0) {
    return (
      <div className={card}>
        <p>Enter a lump sum to compare paying it off HELP with keeping it.</p>
      </div>
    );
  }

  const close = Math.abs(r.advantage) < Math.max(100_00, paid * 0.01);
  const payWins = r.advantage > 0;
  const tag = close ? "Close call" : payWins ? "Pay off HELP" : "Keep the money";
  const ownRate = offset
    ? `Your offset saves ${pct(form.ratePct / 100)} a year.`
    : `Your savings earn ${pct(form.ratePct / 100)}, or ${pct(r.afterTaxRate)} after ${pct(r.taxRate, 0)} tax.`;
  const flip =
    r.breakEvenRate === null ? null : (
      <>
        {payWins ? "Keeping the money wins" : "Paying HELP early comes out ahead"} only if your{" "}
        {offset ? "rate" : "rate before tax"} is {payWins ? "above" : "below"}{" "}
        <strong className="num">{pct(r.breakEvenRate)}</strong>.
      </>
    );

  const series: Series[] = [
    toSeries("Keep the money", "var(--series-base)", r.keep, r.keep.years[0].opening),
    toSeries(
      `Pay ${money(paid)} now`,
      "var(--series-a)",
      r.payNow,
      (r.keep.years[0].opening - paid) as number,
    ),
  ];

  return (
    <>
      <AnswerRow>
        <AnswerCard label={tag}>
          <p className="num -mt-1 text-4xl leading-none font-bold tracking-tight sm:text-5xl">
            {money(Math.abs(r.advantage))}
          </p>
          <p className="text-lg">
            {close ? (
              <>
                {payWins ? "ahead from paying HELP" : "ahead from keeping the money"}. That&apos;s
                about even.
              </>
            ) : payWins ? (
              <>better off paying {money(paid)} off HELP.</>
            ) : (
              <>
                better off with the {money(paid)} in {where}.
              </>
            )}
          </p>
          <p className="text-sm">
            {ownRate} HELP only grows by indexation, about {pct(form.indexationPct / 100, 1)}.{" "}
            {flip}
          </p>
        </AnswerCard>

        <figure className={`${card} min-w-0 rounded-3xl`}>
          <figcaption className="mb-3 font-semibold">HELP balance after each tax return</figcaption>
          <BalanceChart
            series={series}
            label="HELP balance over time, keeping the money or paying now"
          />
        </figure>
      </AnswerRow>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          label="HELP gone"
          value={r.payNow.clearedIn ?? "Not yet"}
          note={
            r.keep.clearedIn
              ? `vs ${r.keep.clearedIn} if you keep it.${r.yearsSooner > 0 ? ` ${r.yearsSooner} year${r.yearsSooner === 1 ? "" : "s"} sooner.` : ""}`
              : "Keeping it, it isn't repaid within 50 years."
          }
        />
        <Stat
          label="Indexation avoided"
          value={money(r.keep.totalIndexation - r.payNow.totalIndexation)}
          note={`${money(r.payNow.totalIndexation)} instead of ${money(r.keep.totalIndexation)}.`}
        />
        <Stat
          label={`In ${where} by ${r.horizon}`}
          value={money(lastKeep.savings)}
          note={`vs ${money(lastPay.savings - lastPay.closing)} if you pay now and save what you no longer repay.`}
        />
      </div>
    </>
  );
}

function YearByYear({ r }: { r: HelpEarlyResult }) {
  return (
    <div className="overflow-x-auto">
      <table className="num w-full text-sm">
        <thead className="text-right text-muted">
          <tr>
            <th className="p-2 text-left font-medium">Year</th>
            <th className="p-2 font-medium">Indexation</th>
            <th className="p-2 font-medium">Compulsory</th>
            <th className="p-2 font-medium">Balance, keep</th>
            <th className="p-2 font-medium">Balance, pay now</th>
          </tr>
        </thead>
        <tbody>
          {r.keep.years.map((y, i) => (
            <tr key={y.year} className="border-t border-border text-right">
              <td className="p-2 text-left">{y.year}</td>
              <td className="p-2">
                {y.indexationDate ? `${pct(y.indexationRate, 1)}${y.rateKnown ? "" : "*"}` : "Done"}
              </td>
              <td className="p-2">{money(y.compulsory)}</td>
              <td className="p-2">{money(y.closing)}</td>
              <td className="p-2">{money(r.payNow.years[i].closing)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        * Your assumption. Past rates are the{" "}
        <a href={HELP_INDEXATION_SOURCE} className="text-accent hover:underline">
          ATO&apos;s
        </a>
        . Compulsory repayments come off after that year&apos;s indexation.
      </p>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={card}>
      <p className="text-sm text-muted">{label}</p>
      <p className="num mt-1 text-xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted">{note}</p>
    </div>
  );
}

/** Balance from today, then after each year's tax return (shown at 30 June). */
function toSeries(name: string, color: string, s: HelpScenario, start: number): Series {
  const now = today();
  const endOf = (fy: string) => `${Number(fy.slice(0, 4)) + 1}-06-30`;
  const points = [{ date: now, balance: start }];
  for (const y of s.years) {
    points.push({ date: endOf(y.year), balance: y.closing });
    if (y.closing <= 0) break;
  }
  return {
    name,
    color,
    points: points as Series["points"],
    payoffDate: s.clearedIn ? endOf(s.clearedIn) : points[points.length - 1].date,
  };
}

function longDate(iso: string): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${Number(iso.slice(8, 10))} ${months[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

function Method() {
  return (
    <div className="space-y-2 text-sm text-muted">
      <p>
        HELP debts don&apos;t charge interest. Each 1 June the ATO adds indexation, the lower of CPI
        and wage growth, to debt that&apos;s more than 11 months old. A voluntary payment before
        then is taken off first.
      </p>
      <p>
        Compulsory repayments are a share of your repayment income, from 0% to 10% at the marginal
        rates that started in 2025-26. They&apos;re withheld from your pay and come off the debt
        when your tax return is assessed, after that year&apos;s indexation. Thresholds the ATO
        hasn&apos;t published yet are assumed to rise with indexation.
      </p>
      <p>
        We compare paying the lump sum today with keeping it in an offset (interest saved isn&apos;t
        taxed) or savings (interest taxed at your marginal rate). Once the debt is gone in the
        pay-now case, the repayments you no longer make are saved at the same rate. Both are
        compared when the debt is gone either way, as savings minus anything still owed.
      </p>
      <p>
        This is general information, not financial advice. New study you add to the loan isn&apos;t
        included.
      </p>
    </div>
  );
}
