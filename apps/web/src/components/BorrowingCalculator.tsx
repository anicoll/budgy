"use client";

import {
  type BorrowingLever,
  type BorrowingResult,
  borrowingLevers,
  borrowingRange,
  validateBorrowing,
} from "@budgy/engine";
import { useMemo } from "react";
import { MoneyField, NumberField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { SavedBar } from "@/components/SavedBar";
import {
  type BorrowForm,
  type BorrowPerson,
  decodeBorrow,
  defaultBorrow,
  encodeBorrow,
  MAX_HOME_LOANS,
  toBorrowInput,
} from "@/lib/borrowState";
import { money } from "@/lib/format";
import { BORROW_PEOPLE } from "@/lib/household";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox } from "./ui";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";

const BORROW_SAVED: SavedConfig<BorrowForm> = {
  tool: "borrow",
  initial: () => defaultBorrow(),
  decode: (q) => decodeBorrow(q),
  encode: encodeBorrow,
  people: BORROW_PEOPLE,
};

/** Lenders quote in round thousands, so do we. */
const thousands = (cents: number) => money(Math.floor(cents / 100_000) * 100_000);
const pct = (rate: number) => `${(rate * 100).toFixed(2)}%`;

const LEVER_LABEL: Record<BorrowingLever, string> = {
  "close-cards": "Close your credit cards",
  "clear-loans": "Pay off your other loans first",
  "lower-spending": "Spend 10% less each month",
  "longer-term": "Take a 30 year loan",
  "rate-down": "A rate 0.5% lower",
  "rate-up": "Rates 1% higher",
};

export function BorrowingCalculator() {
  const saved = useSavedState(BORROW_SAVED);
  const { state: form, setState: setForm } = saved;
  const set = (patch: Partial<BorrowForm>) => setForm((f) => ({ ...f, ...patch }));
  const setPerson = (i: number, patch: Partial<BorrowPerson>) =>
    setForm((f) => ({
      ...f,
      people: f.people.map((p, j) => (j === i ? { ...p, ...patch } : p)),
    }));

  const input = useMemo(() => toBorrowInput(form), [form]);
  const errors = useMemo(() => validateBorrowing(input), [input]);
  const result = useMemo(() => {
    if (errors.length) return null;
    try {
      return { range: borrowingRange(input), levers: borrowingLevers(input) };
    } catch {
      return null;
    }
  }, [input, errors]);

  const couple = form.people.length > 1;
  const setCouple = (two: boolean) =>
    setForm((f) => ({
      ...f,
      people: two ? [f.people[0], f.people[1] ?? { salary: 60_000, help: false }] : [f.people[0]],
    }));
  const who = (i: number) => (couple ? (i === 0 ? " (you)" : " (them)") : "");

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          How much can I borrow?
        </h1>
        <p className="mt-1 max-w-2xl text-muted">
          An estimate of what a bank would lend you, tested the way lenders do: your take-home pay,
          your spending, your other debts, and repayments at your rate plus 3%. Your numbers never
          leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <section className="space-y-4" aria-label="Your details">
          <div className={card}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-semibold">Who&apos;s borrowing</h2>
              <fieldset
                aria-label="Who's borrowing"
                className="m-0 flex overflow-hidden rounded-lg border border-border p-0 text-sm"
              >
                {[false, true].map((two) => (
                  <button
                    key={String(two)}
                    type="button"
                    aria-pressed={couple === two}
                    onClick={() => setCouple(two)}
                    className={`min-h-9 px-3.5 py-1.5 ${
                      couple === two
                        ? "bg-accent font-semibold text-on-accent"
                        : "bg-surface text-muted"
                    }`}
                  >
                    {two ? "Two of us" : "Just me"}
                  </button>
                ))}
              </fieldset>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.people.map((p, i) => (
                <MoneyField
                  key={i}
                  className={couple ? "" : "col-span-2"}
                  label={i === 0 ? "Your salary" : "Their salary"}
                  value={p.salary}
                  onChange={(v) => v !== undefined && setPerson(i, { salary: v })}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">A year, before tax, not counting super.</p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-medium text-accent">
                Overtime, bonuses, rent and HELP
              </summary>
              <div className="mt-3 space-y-4">
                {form.people.map((p, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3">
                    <MoneyField
                      label={`Overtime${who(i)}`}
                      optional
                      placeholder="0"
                      value={p.overtime}
                      onChange={(overtime) => setPerson(i, { overtime })}
                    />
                    <MoneyField
                      label={`Bonuses${who(i)}`}
                      optional
                      placeholder="0"
                      value={p.bonus}
                      onChange={(bonus) => setPerson(i, { bonus })}
                    />
                    <MoneyField
                      label={`Rent received${who(i)}`}
                      optional
                      placeholder="0"
                      value={p.rent}
                      onChange={(rent) => setPerson(i, { rent })}
                    />
                    <MoneyField
                      label={`Other income${who(i)}`}
                      optional
                      placeholder="0"
                      value={p.other}
                      onChange={(other) => setPerson(i, { other })}
                    />
                    <Checkbox
                      className="col-span-2 flex min-h-7 cursor-pointer items-center gap-3"
                      isSelected={p.help}
                      onChange={(v) => setPerson(i, { help: v })}
                    >
                      {i === 0 ? "I have" : "They have"} a HELP or other study debt
                    </Checkbox>
                  </div>
                ))}
                <p className="text-xs text-muted">
                  A year, before tax. Lenders count only part of overtime, bonuses and rent.
                </p>
              </div>
            </details>
          </div>

          <div className={card}>
            <h2 className="mb-3 font-semibold">Household</h2>
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Dependants"
                min={0}
                max={10}
                step={1}
                value={form.dependants}
                onChange={(v) => v !== undefined && set({ dependants: Math.round(v) })}
              />
              <MoneyField
                label="Spending a month"
                value={form.spending}
                onChange={(v) => v !== undefined && set({ spending: v })}
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              Groceries, bills, transport, school, fun. Leave out rent and loan repayments.
            </p>
          </div>

          <div className={card}>
            <h2 className="mb-3 font-semibold">Debts you&apos;ll keep</h2>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                label="Credit card limits"
                value={form.cardLimits}
                onChange={(v) => v !== undefined && set({ cardLimits: v })}
              />
              <MoneyField
                label="Loan repayments / mo"
                value={form.loanRepayments}
                onChange={(v) => v !== undefined && set({ loanRepayments: v })}
              />
              <MoneyField
                label="Owing on those loans"
                optional
                placeholder="0"
                value={form.loanBalances}
                onChange={(loanBalances) => set({ loanBalances })}
              />
              <MoneyField
                label="Other commitments / mo"
                optional
                placeholder="0"
                value={form.otherCommitments}
                onChange={(otherCommitments) => set({ otherCommitments })}
              />
            </div>
            <p className="mt-1 text-xs text-muted">
              Banks count the whole card limit, even if you pay it off each month. Car, personal and
              buy now pay later loans go in repayments. Commitments are things like child support.
            </p>
            {form.homeLoans.map((h, i) => (
              <div key={i} className="mt-3 grid grid-cols-[1fr_7rem_auto] items-end gap-3">
                <MoneyField
                  label={`Home loan ${i + 1} owing`}
                  value={h.balance}
                  onChange={(v) =>
                    v !== undefined &&
                    set({
                      homeLoans: form.homeLoans.map((x, j) => (j === i ? { ...x, balance: v } : x)),
                    })
                  }
                />
                <NumberField
                  label="Years left"
                  min={1}
                  max={40}
                  step={1}
                  value={h.termYears}
                  onChange={(v) =>
                    v !== undefined &&
                    set({
                      homeLoans: form.homeLoans.map((x, j) =>
                        j === i ? { ...x, termYears: v } : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove home loan ${i + 1}`}
                  className="min-h-10 px-2 text-sm text-muted hover:text-text"
                  onClick={() => set({ homeLoans: form.homeLoans.filter((_, j) => j !== i) })}
                >
                  Remove
                </button>
              </div>
            ))}
            {form.homeLoans.length < MAX_HOME_LOANS && (
              <button
                type="button"
                className="mt-3 text-sm font-medium text-accent hover:underline"
                onClick={() =>
                  set({ homeLoans: [...form.homeLoans, { balance: 300_000, termYears: 25 }] })
                }
              >
                + Another home loan
              </button>
            )}
          </div>

          <div className={card}>
            <h2 className="mb-3 font-semibold">The new loan</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField
                label="Rate"
                suffix="%"
                min={0}
                max={20}
                step={0.01}
                value={form.ratePct}
                onChange={(v) => v !== undefined && set({ ratePct: v })}
              />
              <NumberField
                label="Term"
                suffix="yrs"
                min={1}
                max={40}
                step={1}
                value={form.termYears}
                onChange={(v) => v !== undefined && set({ termYears: v })}
              />
              <MoneyField
                className="col-span-2 sm:col-span-1"
                label="Deposit"
                optional
                placeholder="0"
                value={form.deposit}
                onChange={(deposit) => set({ deposit })}
              />
            </div>
          </div>
        </section>

        <section
          className="min-w-0 space-y-4"
          aria-label="What you could borrow"
          aria-live="polite"
        >
          {errors.length > 0 && (
            <div className={`${card} text-warn`}>
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          {result && <Results form={form} year={input.year} {...result} />}
          <GoodToKnow tool="borrow" />
        </section>
      </div>

      {result && (
        <a
          href="#results"
          className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-10 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 text-sm backdrop-blur lg:hidden"
        >
          <span className="num min-w-0">
            {result.range.typical.maxLoan > 0 ? (
              <>
                Borrow about <strong>{thousands(result.range.typical.maxLoan)}</strong>
              </>
            ) : (
              "Not enough left over to borrow"
            )}
          </span>
          <span className="shrink-0 text-accent">See results ↓</span>
        </a>
      )}
    </main>
  );
}

function Results({
  form,
  year,
  range,
  levers,
}: {
  form: BorrowForm;
  year: string;
  range: { low: BorrowingResult; typical: BorrowingResult; high: BorrowingResult };
  levers: ReturnType<typeof borrowingLevers>;
}) {
  const r = range.typical;
  const m = r.monthly;
  const nothing = r.maxLoan <= 0;
  const lo = range.low.maxLoan * 0.9;
  const hi = Math.max(range.high.maxLoan * 1.05, lo + 1);
  const at = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`;
  const capped = r.warnings.find((w) => w.kind === "dti-capped");
  const shading = r.policy.shading;
  const shaded = form.people.some((p) => p.overtime || p.bonus || p.rent);

  return (
    <>
      <div className={`${card} sm:p-7`}>
        <p className="text-sm text-muted">
          {nothing ? "With these numbers, a lender" : "You could probably borrow about"}
        </p>
        <p className="num mt-1.5 text-5xl font-semibold tracking-tight sm:text-6xl">
          {nothing ? "would struggle to lend" : thousands(r.maxLoan)}
        </p>
        {nothing ? (
          <p className="mt-3 text-muted">
            Your spending and debts use up your take-home pay at the {pct(r.assessmentRate)} test
            rate. Try lowering your spending or debts below.
          </p>
        ) : (
          r.price !== null && (
            <p className="mt-3 text-muted">
              That&apos;s a home up to about{" "}
              <strong className="num text-text">{thousands(r.price)}</strong> with your{" "}
              {money(form.deposit ? form.deposit * 100 : 0)} deposit, before stamp duty and fees.
            </p>
          )
        )}

        {!nothing && (
          <div className="mt-7">
            <div className="relative h-3 rounded-full bg-[var(--grid)]" aria-hidden="true">
              <div
                className="absolute inset-y-0 rounded-full bg-accent/25"
                style={{
                  left: at(range.low.maxLoan),
                  right: `calc(100% - ${at(range.high.maxLoan)})`,
                }}
              />
              <div
                className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded bg-accent"
                style={{ left: at(r.maxLoan) }}
              />
            </div>
            <div className="num mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-muted">Cautious lender</span>
                <br />
                <strong className="text-base">{thousands(range.low.maxLoan)}</strong>
              </div>
              <div className="text-center">
                <span className="text-muted">Typical</span>
                <br />
                <strong className="text-base text-accent">{thousands(r.maxLoan)}</strong>
              </div>
              <div className="text-right">
                <span className="text-muted">Generous lender</span>
                <br />
                <strong className="text-base">{thousands(range.high.maxLoan)}</strong>
              </div>
            </div>
          </div>
        )}

        {!nothing && (
          <div className="num mt-7 grid grid-cols-1 gap-3 border-t border-border pt-5 sm:grid-cols-3">
            <Stat
              label={`Repayments at ${pct(form.ratePct / 100)}`}
              value={`${money(r.repayment)} /mo`}
            />
            <Stat
              label={`Bank tests you at ${pct(r.assessmentRate)}`}
              value={`${money(r.assessedRepayment)} /mo`}
            />
            <Stat label="Debt to income" value={`${r.dti.toFixed(1)}×`} />
          </div>
        )}
        {capped && (
          <p className="mt-4 text-sm text-warn">
            Your income could service more, but a typical lender stops at {capped.max} times your
            income in total debt.
          </p>
        )}
      </div>

      <div className={card}>
        <h2 className="font-semibold">How the bank gets there, each month</h2>
        <table className="num mt-3 w-full border-collapse">
          <tbody>
            <Row
              label={couple(form) ? "Take-home pay for both of you" : "Your take-home pay"}
              value={money(m.income)}
            />
            <Row
              label="Living costs"
              note={
                m.expenseFloor > m.declaredExpenses
                  ? `the floor for your household; you said ${money(m.declaredExpenses)}`
                  : `yours; the floor for your household is ${money(m.expenseFloor)}`
              }
              value={`−${money(m.expenses)}`}
              muted
            />
            {m.cards > 0 && (
              <Row
                label="Credit cards"
                note={`${(r.policy.cardFactor * 100).toFixed(1)}% of ${money(form.cardLimits * 100)} limits`}
                value={`−${money(m.cards)}`}
                muted
              />
            )}
            {m.loans > 0 && (
              <Row label="Other loan repayments" value={`−${money(m.loans)}`} muted />
            )}
            {m.homeLoans > 0 && (
              <Row
                label="Other home loans"
                note={`tested at ${pct(r.assessmentRate)}`}
                value={`−${money(m.homeLoans)}`}
                muted
              />
            )}
            {m.other > 0 && <Row label="Other commitments" value={`−${money(m.other)}`} muted />}
            <tr>
              <td className="pt-3 font-semibold">Left for the new loan</td>
              <td
                className={`pt-3 text-right font-semibold ${m.surplus > 0 ? "text-good" : "text-warn"}`}
              >
                {m.surplus < 0 ? `−${money(-m.surplus)}` : money(m.surplus)}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {shaded &&
            `A typical lender counts ${Math.round(shading.overtime * 100)}% of overtime, ${Math.round(shading.bonus * 100)}% of bonuses and ${Math.round(shading.rent * 100)}% of rent. `}
          Take-home pay uses the ATO&apos;s {year} rates, the Medicare levy and HELP repayments.
        </p>
      </div>

      {levers.length > 0 && (
        <div className={card}>
          <h2 className="font-semibold">What would change it</h2>
          <ul className="num mt-3 space-y-2.5">
            {levers.map((l) => (
              <li key={l.lever} className="flex justify-between gap-3">
                <span>{LEVER_LABEL[l.lever]}</span>
                <strong className={l.change >= 0 ? "text-good" : "text-[var(--series-b)]"}>
                  {l.change >= 0 ? "+" : "−"}
                  {thousands(Math.abs(l.change))}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="text-sm leading-relaxed text-muted">
        <summary className="cursor-pointer font-medium text-accent">How we work it out</summary>
        <div className="mt-2 space-y-2">
          <p>
            We work out each person&apos;s take-home pay with this year&apos;s tax rates, then take
            away living costs and the repayments lenders count for your other debts. What&apos;s
            left is the most you could repay each month. The loan is what that repays over your term
            at your rate plus 3%, the buffer APRA expects banks to test with.
          </p>
          <p>
            Living costs are the higher of what you spend and a floor for your household. Banks use
            the Melbourne Institute&apos;s Household Expenditure Measure (HEM), which isn&apos;t
            public, so our floor is our own estimate in the same shape: more for a couple and for
            each dependant, and more as income rises.
          </p>
          <p>
            The range shows how lenders differ: how much of overtime, bonuses and rent they count,
            how much they assume for card limits, and the debt-to-income ratio they stop at.
          </p>
        </div>
      </details>

      <p className="text-sm leading-relaxed text-muted">
        This is an estimate, not a loan offer. Each lender has its own rules and a full credit
        check.
      </p>
    </>
  );
}

const couple = (f: BorrowForm) => f.people.length > 1;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function Row({
  label,
  note,
  value,
  muted,
}: {
  label: string;
  note?: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <tr className="border-b border-[var(--grid)]">
      <td className={`py-2.5 ${muted ? "text-muted" : ""}`}>
        {label}
        {note && <span className="text-sm"> ({note})</span>}
      </td>
      <td className="py-2.5 text-right">{value}</td>
    </tr>
  );
}
