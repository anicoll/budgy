"use client";

import {
  type CoBorrowerResult,
  type CoBorrowResult,
  evenShares,
  type Frequency,
  MAX_PARTIES,
  type OwnershipPoint,
  removeParty,
  setShare,
  splitLoan,
  validateCoBorrow,
} from "@budgy/engine";
import { useMemo, useState } from "react";
import { BalanceChart, type Series } from "@/components/BalanceChart";
import { DateField, MoneyField, NumberField, SelectField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { ResultsBar } from "@/components/ResultsBar";
import { SavedBar } from "@/components/SavedBar";
import { duration, money, moneyExact, monthYear, perPeriod } from "@/lib/format";
import { SPLIT_PEOPLE } from "@/lib/household";
import { objectName, verb } from "@/lib/names";
import { withLoanFields } from "@/lib/saved";
import {
  type Borrower,
  decodeSplitState,
  defaultSplitState,
  encodeSplitState,
  newBorrower,
  nextBorrowerId,
  type SplitLoan,
  type SplitState,
  toCoBorrowInput,
} from "@/lib/splitState";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox } from "./ui";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const COLORS = ["var(--series-a)", "var(--series-b)", "var(--series-c)", "var(--series-base)"];

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "weekly", label: "Weekly" },
];

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const addYearsIso = (iso: string, years: number) =>
  `${Number(iso.slice(0, 4)) + years}${iso.slice(4)}`;

const SPLIT_SAVED: SavedConfig<SplitState> = {
  tool: "split",
  initial: () => defaultSplitState(),
  decode: (q) => decodeSplitState(q),
  encode: encodeSplitState,
  loan: {
    read: ({ loan }) => loan,
    apply: (s, loan) => ({ ...s, loan: withLoanFields(s.loan, loan) }),
  },
  people: SPLIT_PEOPLE,
};

export function SplitCalculator() {
  const saved = useSavedState(SPLIT_SAVED);
  const { state, setState } = saved;
  const [copied, setCopied] = useState(false);

  const input = useMemo(() => toCoBorrowInput(state), [state]);
  const errors = useMemo(() => validateCoBorrow(input), [input]);
  const result = useMemo(() => {
    if (errors.length) return null;
    try {
      return splitLoan(input);
    } catch {
      return null;
    }
  }, [input, errors]);

  const setLoan = (patch: Partial<SplitLoan>) =>
    setState((s) => ({ ...s, loan: { ...s.loan, ...patch } }));
  const setBorrower = (id: string, patch: Partial<Borrower>) =>
    setState((s) => ({
      ...s,
      borrowers: s.borrowers.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  const changeShare = (id: string, value: number) =>
    setState((s) => ({ ...s, borrowers: setShare(s.borrowers, id, value) }));
  const evenUp = () =>
    setState((s) => {
      const shares = evenShares(s.borrowers.length);
      return { ...s, borrowers: s.borrowers.map((b, i) => ({ ...b, sharePct: shares[i] })) };
    });
  const add = () =>
    setState((s) => {
      const id = nextBorrowerId(s.borrowers);
      const all = [...s.borrowers, newBorrower(id, `Borrower ${s.borrowers.length + 1}`, 0)];
      const shares = evenShares(all.length);
      return { ...s, borrowers: all.map((b, i) => ({ ...b, sharePct: shares[i] })) };
    });
  const remove = (id: string) =>
    setState((s) => ({ ...s, borrowers: removeParty(s.borrowers, id) }));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address bar still has the link */
    }
  };

  const { loan } = state;
  const shareTotal = state.borrowers.reduce((s, b) => s + b.sharePct, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Co-borrower split</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Sharing a home loan with a partner, friend or family? Split it by share, see what each of
          you pays, what happens when one of you pays extra, and who owns how much. Your numbers
          never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* ── Inputs ─────────────────────────────────────────────── */}
        <section className="space-y-4" aria-label="The loan and borrowers">
          <div className={card}>
            <h2 className="mb-3 font-semibold">The loan today</h2>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                className="col-span-2"
                label="Loan balance"
                hint="What you owe together now."
                value={loan.balance}
                onChange={(v) => v !== undefined && setLoan({ balance: v })}
              />
              <NumberField
                label="Interest rate"
                suffix="%"
                min={0}
                max={20}
                step={0.01}
                value={loan.ratePct}
                onChange={(v) => v !== undefined && setLoan({ ratePct: v })}
              />
              <NumberField
                label="Years left"
                suffix="yrs"
                min={1}
                max={40}
                step={1}
                value={loan.termYears}
                onChange={(v) => v !== undefined && setLoan({ termYears: v })}
              />
              <SelectField
                label="Repayments"
                value={loan.frequency}
                options={FREQUENCIES}
                onChange={(frequency) => setLoan({ frequency })}
              />
              <MoneyField
                label="Property value"
                optional
                placeholder="Optional"
                value={loan.propertyValue}
                onChange={(propertyValue) => setLoan({ propertyValue })}
              />
              {(loan.frequency === "fortnightly" ||
                state.borrowers.some((b) => b.frequency === "fortnightly")) && (
                <SelectField
                  className="col-span-2"
                  label="How your bank sets fortnightly repayments"
                  value={loan.fortnightlyMethod}
                  options={[
                    { value: "half-monthly", label: "Half the monthly repayment (most common)" },
                    { value: "true", label: "True fortnightly amount" },
                  ]}
                  onChange={(fortnightlyMethod) => setLoan({ fortnightlyMethod })}
                />
              )}
              <DateField
                className="col-span-2"
                label="Starting from"
                value={loan.startDate}
                onChange={(startDate) => setLoan({ startDate })}
              />
            </div>
          </div>

          {state.borrowers.map((b, i) => (
            <BorrowerCard
              key={b.id}
              borrower={b}
              color={COLORS[i]}
              loanFrequency={loan.frequency}
              startDate={loan.startDate}
              onChange={(patch) => setBorrower(b.id, patch)}
              onShare={(v) => changeShare(b.id, v)}
              onRemove={state.borrowers.length > 2 ? () => remove(b.id) : undefined}
            />
          ))}

          <div className="flex flex-wrap items-center gap-2">
            {state.borrowers.length < MAX_PARTIES && (
              <button
                type="button"
                onClick={add}
                className="rounded-full border border-dashed border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
              >
                + Borrower
              </button>
            )}
            <button
              type="button"
              onClick={evenUp}
              className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
            >
              Split evenly
            </button>
            <span
              className={`num ml-auto text-sm ${Math.abs(shareTotal - 100) > 0.005 ? "text-warn" : "text-muted"}`}
            >
              Shares: {Math.round(shareTotal * 100) / 100}%
            </span>
          </div>
        </section>

        {/* ── Results ────────────────────────────────────────────── */}
        <section
          id="results"
          className="min-w-0 scroll-mt-4 space-y-4"
          aria-label="Results"
          aria-live="polite"
        >
          {!result ? (
            <div className={`${card} text-warn`}>
              {errors.length
                ? `Check the inputs: ${errors.join("; ")}.`
                : "Something in the inputs doesn't add up."}
            </div>
          ) : (
            <Results
              result={result}
              frequency={loan.frequency}
              hasValue={loan.propertyValue !== undefined}
              onCopy={copyLink}
              copied={copied}
            />
          )}
          <GoodToKnow tool="split" />
          <Method />
        </section>
      </div>

      {result && (
        <ResultsBar>
          Together <strong>{moneyExact(result.monthlyRepayment)}</strong> a month · free{" "}
          <strong>{monthYear(result.debtFreeDate)}</strong>
        </ResultsBar>
      )}
    </main>
  );
}

function BorrowerCard({
  borrower: b,
  color,
  loanFrequency,
  startDate,
  onChange,
  onShare,
  onRemove,
}: {
  borrower: Borrower;
  color: string;
  loanFrequency: Frequency;
  startDate: string;
  onChange: (patch: Partial<Borrower>) => void;
  onShare: (v: number) => void;
  onRemove?: () => void;
}) {
  const nextYear = addYearsIso(startDate, 1);
  return (
    <div className={card} style={{ borderLeft: `4px solid ${color}` }}>
      <div className="mb-3 flex items-center gap-2">
        <input
          aria-label="Borrower name"
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none focus:underline"
          value={b.name}
          maxLength={40}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-sm text-muted hover:text-warn">
            Remove
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Share of the loan"
          suffix="%"
          min={0}
          max={100}
          step={1}
          value={b.sharePct}
          onChange={(v) => v !== undefined && onShare(v)}
        />
        <MoneyField
          label="Put in up front"
          hint="Deposit and costs."
          value={b.deposit}
          optional
          placeholder="0"
          onChange={(deposit) => onChange({ deposit: deposit ?? 0 })}
        />
        <MoneyField
          label="Extra each repayment"
          optional
          placeholder="0"
          value={b.extra}
          onChange={(extra) => onChange({ extra })}
        />
        <SelectField
          label="Repays"
          value={b.frequency ?? ("same" as Frequency)}
          options={[
            {
              value: "same" as Frequency,
              label: `Same (${loanFrequency})`,
            },
            ...FREQUENCIES,
          ]}
          onChange={(f) => onChange({ frequency: (f as string) === "same" ? undefined : f })}
        />
        <MoneyField
          label="Own offset"
          optional
          placeholder="0"
          value={b.offset}
          onChange={(offset) => onChange({ offset })}
        />
        <MoneyField
          label="Added each month"
          optional
          placeholder="0"
          value={b.offsetDeposit}
          onChange={(offsetDeposit) => onChange({ offsetDeposit })}
        />
        <MoneyField
          label="Lump sum"
          optional
          placeholder="0"
          value={b.lumpSum?.amount}
          onChange={(amount) =>
            onChange({
              lumpSum: amount ? { date: nextYear, yearly: false, ...b.lumpSum, amount } : undefined,
            })
          }
        />
        {b.lumpSum ? (
          <DateField
            label="Paid on"
            value={b.lumpSum.date}
            onChange={(date) => b.lumpSum && onChange({ lumpSum: { ...b.lumpSum, date } })}
          />
        ) : (
          <div />
        )}
        {b.lumpSum && (
          <Checkbox
            className="col-span-2 -mt-1 flex items-center gap-2 text-sm"
            isSelected={b.lumpSum.yearly}
            onChange={(v) => b.lumpSum && onChange({ lumpSum: { ...b.lumpSum, yearly: v } })}
          >
            Repeat every year
          </Checkbox>
        )}
      </div>
    </div>
  );
}

function Results({
  result,
  frequency,
  hasValue,
  onCopy,
  copied,
}: {
  result: CoBorrowResult;
  frequency: Frequency;
  hasValue: boolean;
  onCopy: () => void;
  copied: boolean;
}) {
  const { parties } = result;
  const series: Series[] = parties.map((p, i) => ({
    name: p.name,
    color: COLORS[i],
    points: p.result.balances,
    payoffDate: p.result.payoffDate,
  }));
  const savers = parties.filter((p) => p.interestSaved > 0);

  return (
    <>
      <div className={`${card} space-y-2 text-lg leading-relaxed`}>
        <p>
          Together you pay <strong className="num">{moneyExact(result.monthlyRepayment)}</strong> a
          month
          {result.monthlyRepayment !== result.monthlyMinimum && (
            <> (the minimum is {moneyExact(result.monthlyMinimum)})</>
          )}
          , and the loan is gone in <strong>{monthYear(result.debtFreeDate)}</strong>.
        </p>
        {new Set(parties.map((p) => p.result.payoffDate)).size > 1 && (
          <p>
            {parties.map((p, i) => (
              <span key={p.id}>
                {i > 0 && (i === parties.length - 1 ? " and " : ", ")}
                <span className="font-semibold" style={{ color: COLORS[i] }}>
                  {p.name}
                </span>{" "}
                {verb(p.name, "is", "are")} clear in {monthYear(p.result.payoffDate)}
              </span>
            ))}
            .
          </p>
        )}
        {savers.map((p) => (
          <p key={p.id}>
            Paying extra saves {objectName(p.name)}{" "}
            <strong className="num text-good">{money(p.interestSaved)}</strong> in interest and{" "}
            {duration(p.daysSaved)}. Splitting the interest by share would charge{" "}
            {objectName(p.name)}{" "}
            <strong className="num">{money(p.proRataInterest - p.result.totalInterest)}</strong> too
            much.
          </p>
        ))}
        {result.warnings.map((w) => (
          <p key={w} className="text-sm text-warn">
            {w}
          </p>
        ))}
      </div>

      <div className={card}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">What each of you owes</h2>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
        <BalanceChart series={series} label="Each borrower's share of the loan over time" />
      </div>

      <SideBySide parties={parties} frequency={frequency} />
      <Ownership result={result} hasValue={hasValue} />
    </>
  );
}

function SideBySide({ parties, frequency }: { parties: CoBorrowerResult[]; frequency: Frequency }) {
  const rows: [string, (p: CoBorrowerResult) => React.ReactNode][] = [
    ["Share", (p) => `${p.sharePct}%`],
    ["Their part of the loan", (p) => money(p.portion)],
    [
      "Minimum repayment",
      (p) => (
        <>
          {moneyExact(p.result.minimumRepayment)}
          {p.frequency !== frequency && (
            <span className="text-muted"> {perPeriod[p.frequency]}</span>
          )}
        </>
      ),
    ],
    [
      "Paying",
      (p) => (
        <>
          {moneyExact(p.result.repayment)}
          {p.frequency !== frequency && (
            <span className="text-muted"> {perPeriod[p.frequency]}</span>
          )}
        </>
      ),
    ],
    ["Clear by", (p) => monthYear(p.result.payoffDate)],
    ["Interest paid", (p) => money(p.result.totalInterest)],
    ["Saved by extras", (p) => (p.interestSaved > 0 ? money(p.interestSaved) : "–")],
    ["Interest split by share*", (p) => money(p.proRataInterest)],
  ];
  return (
    <div className={`${card} overflow-x-auto`}>
      <h2 className="mb-3 font-semibold">Side by side</h2>
      <table className={`num w-full text-sm ${parties.length > 2 ? "min-w-[420px]" : ""}`}>
        <thead>
          <tr className="text-left text-muted">
            <th className="py-1.5 pr-3 font-medium" />
            {parties.map((p, i) => (
              <th
                key={p.id}
                className="py-1.5 pr-3 text-right font-medium"
                style={{ color: COLORS[i] }}
              >
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td:not(:first-child)]:text-right">
          {rows.map(([label, cell]) => (
            <tr key={label}>
              <td>{label}</td>
              {parties.map((p) => (
                <td key={p.id}>{cell(p)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">
        Repayments are {perPeriod[frequency]} unless marked. *What each of you would pay if the
        loan&apos;s total interest were simply divided by share, ignoring who paid extra.
      </p>
    </div>
  );
}

function Ownership({ result, hasValue }: { result: CoBorrowResult; hasValue: boolean }) {
  const { ownership, parties } = result;
  const last = ownership.length - 1;
  const picks = [...new Set([0, 5, 10, last].filter((y) => y <= last))];
  const label = (p: OwnershipPoint) =>
    p.year === 0 ? "Today" : p.year === last ? "Loan paid off" : `In ${p.year} years`;
  return (
    <div className={card}>
      <h2 className="font-semibold">Who owns how much</h2>
      <p className="mt-1 mb-3 text-sm text-muted">
        Based on what each of you has put in: up-front money plus the loan you&apos;ve repaid.
        Interest isn&apos;t counted, because it buys nothing.
        {hasValue && " Equity uses today's property value."}
      </p>
      <div className="space-y-3">
        {picks.map((y) => {
          const p = ownership[y];
          return (
            <div key={y}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{label(p)}</span>
                <span className="text-muted">{y === 0 ? "" : monthYear(p.date)}</span>
              </div>
              <div className="flex h-6 overflow-hidden rounded-md text-xs font-medium text-bg">
                {p.shares.map((s, i) => (
                  <div
                    key={parties[i].id}
                    className="flex items-center justify-center overflow-hidden whitespace-nowrap"
                    style={{ width: `${s * 100}%`, background: COLORS[i] }}
                    title={`${parties[i].name}: ${pct(s)}`}
                  >
                    {s >= 0.12 && pct(s)}
                  </div>
                ))}
              </div>
              <div className="num mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
                {parties.map((party, i) => (
                  <span key={party.id}>
                    {party.name} {pct(p.shares[i])}
                    {hasValue && p.equity && <> · equity {money(p.equity[i])}</>}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium">Year by year</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="num w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-right text-muted [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium">
                <th className="text-left">Year</th>
                <th>Loan left</th>
                {parties.map((p) => (
                  <th key={p.id}>{p.name} put in</th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-1.5 [&_td]:pr-3 [&_td]:text-right">
              {ownership.map((p) => (
                <tr key={p.year}>
                  <td className="!text-left">
                    {p.year} <span className="text-muted">({p.date.slice(0, 7)})</span>
                  </td>
                  <td>{money(p.balance)}</td>
                  {p.contributed.map((c, i) => (
                    <td key={parties[i].id}>
                      {money(c)} <span className="text-muted">({pct(p.shares[i])})</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function Method() {
  return (
    <details className={`${card} text-sm`}>
      <summary className="cursor-pointer font-semibold">How this is calculated</summary>
      <div className="mt-3 space-y-2 text-muted">
        <p>
          Your bank sees one loan, and each of you is usually liable for all of it. This tool tracks
          what&apos;s fair between you by giving each person their own part of the balance, based on
          their share.
        </p>
        <p>
          Each part is worked out the way the mortgage what-if does it: interest daily (rate ÷ 365)
          on that part less that person&apos;s own offset, charged monthly, with repayments on real
          dates. Each person&apos;s minimum is the standard repayment on their part over the years
          left, so together the minimums cover the loan. Extras, offset savings and lump sums only
          shrink the part of the person who paid them.
        </p>
        <p>
          Ownership here is by contribution: money put in up front plus the loan each of you has
          repaid. It&apos;s one common way to think about it, not the only one. Many co-owners
          record their shares in a written agreement, and a lawyer can help with that.
        </p>
        <p>
          Your bank&apos;s figures may differ a little because of rounding, fees and the exact day
          it charges interest. This is general information, not financial or legal advice.
        </p>
      </div>
    </details>
  );
}
