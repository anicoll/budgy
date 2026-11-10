"use client";

import {
  compareStrategies,
  type PayoffResult,
  simulatePayoff,
  solveExtraPerMonth,
  validateDebts,
  withBalanceTransfer,
} from "@budgy/engine";
import { useMemo, useState } from "react";
import { BalanceChart, type Series } from "@/components/BalanceChart";
import { DateField, MoneyField, NumberField, SelectField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { SavedBar } from "@/components/SavedBar";
import {
  type DebtPlanState,
  type DebtRow,
  decodeDebtState,
  defaultDebtState,
  encodeDebtState,
  MAX_ROWS,
  newDebt,
  nextId,
  type PlanStrategy,
  syncOrder,
  type TransferForm,
  toPayoffInput,
  toTransfer,
} from "@/lib/debtState";
import { duration, money, moneyExact, monthYear } from "@/lib/format";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox } from "./ui";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const chip = "rounded-full border px-3 py-1.5 text-sm";

const STRATEGIES: { value: PlanStrategy; label: string; blurb: string }[] = [
  { value: "avalanche", label: "Avalanche", blurb: "Highest interest rate first. Least interest." },
  { value: "snowball", label: "Snowball", blurb: "Smallest balance first. Quickest wins." },
  { value: "custom", label: "My order", blurb: "You choose which debt to clear first." },
];
const LABEL: Record<string, string> = {
  avalanche: "Avalanche",
  snowball: "Snowball",
  custom: "My order",
  minimums: "Minimums only",
};
const COLOR: Record<string, string> = {
  avalanche: "var(--series-a)",
  snowball: "var(--series-b)",
  custom: "var(--series-c)",
  minimums: "var(--series-base)",
};

const months = (n: number) => duration(n * 30.4375);

const DEBT_SAVED: SavedConfig<DebtPlanState> = {
  tool: "debt",
  initial: () => defaultDebtState(),
  decode: (q) => decodeDebtState(q),
  encode: encodeDebtState,
};

export function DebtPlanner() {
  const saved = useSavedState(DEBT_SAVED);
  const { state, setState } = saved;
  const [copied, setCopied] = useState(false);

  const input = useMemo(() => toPayoffInput(state), [state]);
  const errors = useMemo(() => validateDebts(input.debts, input.extraPerMonth), [input]);
  const plans = useMemo(() => {
    if (errors.length) return null;
    try {
      return compareStrategies({ ...input, order: state.strategy === "custom" ? input.order : [] });
    } catch {
      return null;
    }
  }, [input, errors, state.strategy]);

  const setDebt = (id: string, patch: Partial<DebtRow>) =>
    setState((s) => ({ ...s, debts: s.debts.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  const addDebt = (kind: "card" | "loan") =>
    setState((s) => {
      const debts = [...s.debts, newDebt(nextId(s.debts), kind)];
      return { ...s, debts, order: syncOrder(s.order, debts) };
    });
  const removeDebt = (id: string) =>
    setState((s) => {
      const debts = s.debts.filter((d) => d.id !== id);
      return { ...s, debts, order: syncOrder(s.order, debts) };
    });
  const move = (id: string, by: -1 | 1) =>
    setState((s) => {
      const order = s.order.slice();
      const i = order.indexOf(id);
      const j = i + by;
      if (i < 0 || j < 0 || j >= order.length) return s;
      [order[i], order[j]] = [order[j], order[i]];
      return { ...s, order };
    });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address bar still has the link */
    }
  };

  const chosen = plans ? (plans[state.strategy] ?? plans.avalanche) : null;

  // The same plan with the ticked debts on a balance transfer card.
  const transfer = useMemo(() => {
    const t = toTransfer(state);
    if (!t || !chosen) return null;
    try {
      const input = withBalanceTransfer({ ...toPayoffInput(state), strategy: state.strategy }, t);
      const plan = simulatePayoff(input);
      const minimumsOnly = simulatePayoff({
        ...input,
        extraPerMonth: 0 as typeof input.extraPerMonth,
      });
      const card = input.debts.find((d) => d.promo);
      const movedBalance = state.debts
        .filter((d) => t.from.includes(d.id))
        .reduce((sum, d) => sum + Math.round(d.balance * 100), 0);
      const fee = card ? Math.max(0, card.balance - movedBalance) : 0;
      return { plan, minimumsOnly, transfer: t, fee };
    } catch {
      return null;
    }
  }, [state, chosen]);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Debt payoff planner</h1>
        <p className="mt-1 max-w-2xl text-muted">
          List your debts and what you can put towards them each month. See which to pay first and
          when you&apos;ll be debt-free. Your numbers never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* ── Inputs ─────────────────────────────────────────────── */}
        <section className="space-y-4" aria-label="Your debts and plan">
          {state.debts.map((d) => (
            <DebtCard
              key={d.id}
              debt={d}
              onChange={(patch) => setDebt(d.id, patch)}
              onRemove={state.debts.length > 1 ? () => removeDebt(d.id) : undefined}
            />
          ))}
          {state.debts.length < MAX_ROWS && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addDebt("card")}
                className={`${chip} border-dashed border-border hover:border-accent hover:text-accent`}
              >
                + Credit card
              </button>
              <button
                type="button"
                onClick={() => addDebt("loan")}
                className={`${chip} border-dashed border-border hover:border-accent hover:text-accent`}
              >
                + Loan
              </button>
            </div>
          )}

          <div className={card}>
            <h2 className="mb-3 font-semibold">Your plan</h2>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                className="col-span-2"
                label="Extra each month"
                hint="On top of your minimums. When a debt is paid off, its minimum moves to the next one."
                value={state.extra}
                optional
                placeholder="0"
                onChange={(v) => setState((s) => ({ ...s, extra: v ?? 0 }))}
              />
              <fieldset className="col-span-2">
                <legend className="mb-1 text-sm font-medium">Pay off first</legend>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  {STRATEGIES.map((o) => (
                    <label
                      key={o.value}
                      className={`cursor-pointer rounded-lg border p-2.5 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/25 ${
                        state.strategy === o.value ? "border-accent" : "border-border"
                      }`}
                    >
                      <input
                        type="radio"
                        name="strategy"
                        className="sr-only"
                        checked={state.strategy === o.value}
                        onChange={() => setState((s) => ({ ...s, strategy: o.value }))}
                      />
                      <span className="block font-medium">{o.label}</span>
                      <span className="block text-xs text-muted">{o.blurb}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {state.strategy === "custom" && (
                <ol className="col-span-2 space-y-1.5">
                  {state.order.map((id, i) => {
                    const d = state.debts.find((x) => x.id === id);
                    if (!d) return null;
                    return (
                      <li
                        key={id}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm"
                      >
                        <span className="num w-5 text-muted">{i + 1}.</span>
                        <span className="min-w-0 flex-1 truncate">{d.name || "Debt"}</span>
                        <button
                          type="button"
                          aria-label={`Move ${d.name} up`}
                          disabled={i === 0}
                          onClick={() => move(id, -1)}
                          className="px-1.5 text-muted hover:text-accent disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${d.name} down`}
                          disabled={i === state.order.length - 1}
                          onClick={() => move(id, 1)}
                          className="px-1.5 text-muted hover:text-accent disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              <DateField
                className="col-span-2"
                label="Starting from"
                hint="Your first payment is a month after this."
                value={state.startDate}
                onChange={(startDate) => setState((s) => ({ ...s, startDate }))}
              />
            </div>
          </div>

          <TransferCard
            debts={state.debts}
            form={state.transfer}
            onChange={(patch) => setState((s) => ({ ...s, transfer: { ...s.transfer, ...patch } }))}
          />
        </section>

        {/* ── Results ────────────────────────────────────────────── */}
        <section
          id="results"
          className="min-w-0 scroll-mt-4 space-y-4"
          aria-label="Results"
          aria-live="polite"
        >
          {!plans || !chosen ? (
            <div className={`${card} text-warn`}>
              {errors.length
                ? `Check your debts: ${errors.join("; ")}.`
                : "Something in the inputs doesn't add up."}
            </div>
          ) : (
            <>
              {transfer && (
                <TransferResults
                  now={chosen}
                  {...transfer}
                  movedNames={state.debts
                    .filter((d) => transfer.transfer.from.includes(d.id))
                    .map((d) => d.name || "Debt")}
                />
              )}
              <Headline plan={chosen} baseline={plans.minimums} />
              <Compare
                plans={[
                  chosen,
                  ...(["avalanche", "snowball"] as const)
                    .filter((k) => k !== state.strategy)
                    .map((k) => plans[k]),
                  plans.minimums,
                ]}
                onCopy={copyLink}
                copied={copied}
              />
              <Order plan={chosen} />
              <TargetDate
                state={state}
                plan={chosen}
                onTarget={(target) => setState((s) => ({ ...s, target }))}
              />
              <MonthByMonth plan={chosen} names={state.debts.map((d) => d.name || "Debt")} />
            </>
          )}
          <GoodToKnow tool="debt" />
          <Method />
        </section>
      </div>

      {chosen && (
        <a
          href="#results"
          className="fixed inset-x-0 bottom-[var(--bottom-nav-h)] z-10 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-4 py-3 text-sm backdrop-blur lg:hidden"
        >
          <span className="num min-w-0">
            {chosen.paidOff ? (
              <>
                Debt-free <strong>{monthYear(chosen.debtFreeDate)}</strong> ·{" "}
                {money(chosen.totalInterest)} interest
              </>
            ) : (
              "Not repaid at this budget"
            )}
          </span>
          <span className="shrink-0 text-accent">See results ↓</span>
        </a>
      )}
    </main>
  );
}

function DebtCard({
  debt: d,
  onChange,
  onRemove,
}: {
  debt: DebtRow;
  onChange: (patch: Partial<DebtRow>) => void;
  onRemove?: () => void;
}) {
  return (
    <div className={card}>
      <div className="mb-3 flex items-center gap-2">
        <input
          aria-label="Debt name"
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none focus:underline"
          value={d.name}
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
        <MoneyField
          label="Balance"
          value={d.balance}
          onChange={(v) => v !== undefined && onChange({ balance: v })}
        />
        <NumberField
          label="Interest rate"
          suffix="%"
          min={0}
          max={100}
          step={0.01}
          value={d.ratePct}
          onChange={(v) => v !== undefined && onChange({ ratePct: v })}
        />
        <SelectField
          className="col-span-2"
          label="Minimum repayment"
          value={d.minType}
          options={[
            { value: "fixed", label: "A set amount each month" },
            { value: "percent", label: "A % of the balance (credit cards)" },
          ]}
          onChange={(minType) => onChange({ minType })}
        />
        {d.minType === "fixed" ? (
          <MoneyField
            className="col-span-2"
            label="Each month"
            value={d.minAmount}
            onChange={(v) => v !== undefined && onChange({ minAmount: v })}
          />
        ) : (
          <>
            <NumberField
              label="Percent of balance"
              suffix="%"
              min={0.1}
              max={100}
              step={0.1}
              value={d.minPct}
              onChange={(v) => v !== undefined && onChange({ minPct: v })}
            />
            <MoneyField
              label="Or at least"
              hint="Check your statement."
              value={d.minFloor}
              onChange={(v) => v !== undefined && onChange({ minFloor: v })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Headline({ plan, baseline }: { plan: PayoffResult; baseline: PayoffResult }) {
  if (!plan.paidOff) {
    return (
      <div className={`${card} text-lg text-warn`}>
        At {moneyExact(plan.monthlyBudget)} a month, these debts aren&apos;t repaid within 100
        years. Add an extra amount each month.
      </div>
    );
  }
  const sooner = baseline.months - plan.months;
  const saved = baseline.totalInterest - plan.totalInterest;
  return (
    <div className={`${card} space-y-2 text-lg leading-relaxed`}>
      <p>
        Paying <strong className="num">{moneyExact(plan.monthlyBudget)}</strong> a month{" "}
        {plan.strategy === "custom" ? "in your order" : `with ${plan.strategy}`}, you&apos;re
        debt-free in <strong>{monthYear(plan.debtFreeDate)}</strong> ({months(plan.months)}) and pay{" "}
        <strong className="num">{money(plan.totalInterest)}</strong> in interest.
      </p>
      {sooner > 0 && (
        <p>
          That&apos;s <strong>{months(sooner)}</strong> sooner and{" "}
          <strong className="num text-good">{money(saved)}</strong> less interest than paying only
          the minimums
          {baseline.paidOff ? "" : ", which never clears them"}.
        </p>
      )}
      {[...new Set([...plan.warnings, ...baseline.warnings])].map((w) => (
        <p key={w} className="text-sm text-warn">
          {w}
        </p>
      ))}
    </div>
  );
}

function Compare({
  plans,
  onCopy,
  copied,
}: {
  plans: PayoffResult[];
  onCopy: () => void;
  copied: boolean;
}) {
  // Minimums only can run for decades and squash the plans into a sliver, so
  // leave it off the chart when it's much longer and say so underneath.
  const fastest = Math.min(...plans.filter((p) => p.strategy !== "minimums").map((p) => p.months));
  const offChart = plans.find((p) => p.strategy === "minimums" && p.months > fastest * 3);
  const series: Series[] = plans
    .filter((p) => p !== offChart)
    .map((p) => ({
      name: LABEL[p.strategy],
      color: COLOR[p.strategy],
      points: p.timeline.map((m) => ({ date: m.date, balance: m.total })),
      payoffDate: p.debtFreeDate,
    }));
  return (
    <>
      <div className={card}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Total owed</h2>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
        <BalanceChart series={series} label="Total debt over time for each strategy" />
        {offChart && (
          <p className="text-xs text-muted">
            Paying only the minimums is left off the chart: it runs{" "}
            {offChart.paidOff ? `until ${monthYear(offChart.debtFreeDate)}` : "for over 100 years"}.
          </p>
        )}
      </div>
      <div className={`${card} overflow-x-auto`}>
        <h2 className="mb-3 font-semibold">Strategies side by side</h2>
        <table className="num w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1.5 pr-3 font-medium" />
              {plans.map((p) => (
                <th
                  key={p.strategy}
                  className="py-1.5 pr-3 text-right font-medium"
                  style={{ color: COLOR[p.strategy] }}
                >
                  {LABEL[p.strategy]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td]:pr-3 [&_td:not(:first-child)]:text-right">
            <tr>
              <td>Paid each month</td>
              {plans.map((p) => (
                <td key={p.strategy}>
                  {moneyExact(p.monthlyBudget)}
                  {p.strategy === "minimums" && "*"}
                </td>
              ))}
            </tr>
            <tr>
              <td>Debt-free</td>
              {plans.map((p) => (
                <td key={p.strategy}>{p.paidOff ? monthYear(p.debtFreeDate) : "Never"}</td>
              ))}
            </tr>
            <tr>
              <td>Time</td>
              {plans.map((p) => (
                <td key={p.strategy}>{p.paidOff ? months(p.months) : "100+ years"}</td>
              ))}
            </tr>
            <tr>
              <td>Total interest</td>
              {plans.map((p) => (
                <td key={p.strategy}>{money(p.totalInterest)}</td>
              ))}
            </tr>
            <tr>
              <td>Total paid</td>
              {plans.map((p) => (
                <td key={p.strategy}>{money(p.totalPaid)}</td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          *At the start. Paying only the minimums means paying less as balances fall, and no
          rollover when a debt is cleared.
        </p>
      </div>
    </>
  );
}

function Order({ plan }: { plan: PayoffResult }) {
  const longest = Math.max(1, ...plan.debts.map((d) => d.months ?? plan.months));
  const byId = new Map(plan.debts.map((d) => [d.id, d]));
  return (
    <div className={card}>
      <h2 className="mb-3 font-semibold">Payoff order</h2>
      <ol className="space-y-3">
        {plan.priority.map((id, i) => {
          const d = byId.get(id);
          if (!d) return null;
          const m = d.months ?? plan.months;
          return (
            <li key={id} className="text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">
                  <span className="num text-muted">{i + 1}.</span> {d.name}
                </span>
                <span className="num text-muted">
                  {d.payoffDate ? `Paid off ${monthYear(d.payoffDate)}` : "Not repaid"} ·{" "}
                  {money(d.interest)} interest
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-[var(--grid)]">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(2, (m / longest) * 100)}%`,
                    background: COLOR[plan.strategy],
                  }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TargetDate({
  state,
  plan,
  onTarget,
}: {
  state: DebtPlanState;
  plan: PayoffResult;
  onTarget: (target: string | undefined) => void;
}) {
  const target = state.target;
  const extra = useMemo(() => {
    if (!target) return undefined;
    try {
      return solveExtraPerMonth({ ...toPayoffInput(state), strategy: state.strategy }, target);
    } catch {
      return undefined;
    }
  }, [state, target]);
  const currentExtra = Math.round(state.extra * 100);
  return (
    <div className={card}>
      <h2 className="mb-3 font-semibold">Want to be debt-free sooner?</h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-end">
        <DateField
          label="Debt-free by"
          value={target ?? ""}
          onChange={(v) => onTarget(v || undefined)}
        />
        <p className="text-sm sm:pb-2.5">
          {target === undefined || extra === undefined ? (
            <span className="text-muted">
              Pick a date to see the extra you&apos;d need each month.
            </span>
          ) : extra === null ? (
            <span className="text-warn">That date is too soon to clear everything.</span>
          ) : extra <= currentExtra && plan.paidOff && plan.debtFreeDate <= target ? (
            <>You&apos;re already on track, with {months(plan.months)} to go.</>
          ) : (
            <>
              Put <strong className="num">{money(extra)}</strong> extra a month towards your debts (
              {money(extra - currentExtra)} more than now).
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function MonthByMonth({ plan, names }: { plan: PayoffResult; names: string[] }) {
  const rows = plan.timeline.slice(1);
  return (
    <details className={card}>
      <summary className="cursor-pointer font-semibold">Month by month</summary>
      <div className="mt-3 max-h-[480px] overflow-auto">
        <table className="num w-full min-w-[480px] text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="text-right text-muted [&_th]:py-1.5 [&_th]:pr-3 [&_th]:font-medium">
              <th className="text-left">Month</th>
              <th>Paid</th>
              <th>Interest</th>
              {names.map((n, i) => (
                <th key={i} className="max-w-28 truncate">
                  {n}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-1.5 [&_td]:pr-3 [&_td]:text-right">
            {rows.map((m) => (
              <tr key={m.month}>
                <td className="!text-left">{m.date.slice(0, 7)}</td>
                <td>{moneyExact(m.paid)}</td>
                <td>{moneyExact(m.interest)}</td>
                {m.balances.map((b, i) => (
                  <td key={i} className={b === 0 ? "text-muted" : undefined}>
                    {b === 0 ? "–" : money(b)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function Method() {
  return (
    <details className={`${card} text-sm`}>
      <summary className="cursor-pointer font-semibold">How this is calculated</summary>
      <div className="mt-3 space-y-2 text-muted">
        <p>
          Each month, interest is added to every debt at its yearly rate ÷ 12. Then each debt&apos;s
          minimum is paid, and whatever is left of your monthly amount goes to the debt at the top
          of your order. Once it&apos;s cleared, the money moves to the next one.
        </p>
        <p>
          Your monthly amount stays the same the whole way: your minimums today plus your extra.
          That&apos;s why paying off one debt speeds up the rest. Credit card minimums are worked
          out on the balance after interest, as a percentage with a dollar minimum, like most
          Australian cards.
        </p>
        <p>
          Avalanche pays the least interest. Snowball clears small debts first, which many people
          find easier to stick with. &ldquo;Minimums only&rdquo; shows what happens if you change
          nothing.
        </p>
        <p>
          Real cards charge interest daily and may have fees, interest-free periods or promo rates,
          so your figures can differ a little. This is general information, not financial advice.
        </p>
      </div>
    </details>
  );
}

function TransferCard({
  debts,
  form,
  onChange,
}: {
  debts: DebtRow[];
  form: TransferForm;
  onChange: (patch: Partial<TransferForm>) => void;
}) {
  const toggle = (id: string, on: boolean) =>
    onChange({ from: on ? [...form.from, id] : form.from.filter((x) => x !== id) });
  return (
    <div className={card}>
      <h2 className="font-semibold">Try a balance transfer</h2>
      <p className="mb-3 text-xs text-muted">
        Move debts onto a new card with a low intro rate, and see if the fee is worth it.
      </p>
      <fieldset className="mb-3">
        <legend className="mb-1 text-sm font-medium">Move these debts</legend>
        <div className="space-y-1">
          {debts.map((d) => (
            <Checkbox
              key={d.id}
              className="flex min-h-9 items-center text-sm"
              isSelected={form.from.includes(d.id)}
              onChange={(on) => toggle(d.id, on)}
            >
              {d.name || "Debt"} ({money(Math.round(d.balance * 100))})
            </Checkbox>
          ))}
        </div>
      </fieldset>
      {form.from.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Intro rate"
              suffix="%"
              min={0}
              max={100}
              step={0.01}
              value={form.promoPct}
              onChange={(v) => v !== undefined && onChange({ promoPct: v })}
            />
            <NumberField
              label="For"
              suffix="months"
              min={1}
              max={120}
              step={1}
              value={form.months}
              onChange={(v) => v !== undefined && onChange({ months: Math.round(v) })}
            />
            <NumberField
              label="Transfer fee"
              suffix="%"
              min={0}
              max={20}
              step={0.1}
              value={form.feePct}
              onChange={(v) => v !== undefined && onChange({ feePct: v })}
            />
            <NumberField
              label="Then"
              suffix="%"
              min={0}
              max={100}
              step={0.01}
              value={form.revertPct}
              onChange={(v) => v !== undefined && onChange({ revertPct: v })}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            &ldquo;Then&rdquo; is the rate it reverts to, often the card&apos;s cash or purchase
            rate. Check the offer&apos;s fine print. We assume a minimum of 2% or $25.
          </p>
        </>
      )}
    </div>
  );
}

function TransferResults({
  now,
  plan,
  minimumsOnly,
  transfer,
  fee,
  movedNames,
}: {
  now: PayoffResult;
  plan: PayoffResult;
  minimumsOnly: PayoffResult;
  transfer: { promoMonths: number; revertRate: number; promoRate: number };
  fee: number;
  movedNames: string[];
}) {
  const btDebt = plan.debts.find((d) => d.promoEndDate);
  const minDebt = minimumsOnly.debts.find((d) => d.promoEndDate);
  const costNow = now.totalInterest;
  const costBt = plan.totalInterest + fee;
  const saved = costNow - costBt;
  const sooner = now.months - plan.months;
  const promoEnd = btDebt?.promoEndDate;
  const clearedBy = btDebt?.payoffDate;
  const leftAtEnd = btDebt?.owingWhenPromoEnds ?? 0;
  const monthsSpare =
    clearedBy && btDebt?.months != null ? transfer.promoMonths - btDebt.months : 0;
  const ratePct = (r: number) => `${(r * 100).toFixed(2).replace(/\.00$/, "")}%`;
  const promo = ratePct(transfer.promoRate);
  return (
    <>
      <div className="space-y-3 rounded-2xl bg-primary-container p-5 text-on-primary-container sm:p-6">
        <p className="text-lg leading-relaxed sm:text-xl">
          {!plan.paidOff ? (
            <>With the transfer, these debts still aren&apos;t repaid at this budget.</>
          ) : (
            <>
              With the transfer you&apos;re debt-free in{" "}
              <strong>{monthYear(plan.debtFreeDate)}</strong>
              {sooner > 0 ? (
                <>, {months(sooner)} sooner,</>
              ) : sooner < 0 ? (
                <>, {months(-sooner)} later,</>
              ) : (
                ","
              )}{" "}
              and pay{" "}
              {saved >= 0 ? (
                <strong className="num">{money(saved)} less</strong>
              ) : (
                <strong className="num">{money(-saved)} more</strong>
              )}{" "}
              in interest and fees.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          {fee > 0 && (
            <span className="num rounded-full bg-white/60 px-3 py-1.5">
              {money(fee)} transfer fee included
            </span>
          )}
          {leftAtEnd === 0 && monthsSpare > 0 && (
            <span className="rounded-full bg-white/60 px-3 py-1.5">
              Card cleared {months(monthsSpare)} before the {promo} ends
            </span>
          )}
        </div>
      </div>

      <div className={`${card} overflow-x-auto`}>
        <h2 className="mb-3 font-semibold">Side by side</h2>
        <table className="num w-full min-w-[360px] text-sm">
          <thead>
            <tr className="text-right text-muted [&_th]:py-1.5 [&_th]:font-medium">
              <th />
              <th>As you are</th>
              <th className="text-accent">With the transfer</th>
            </tr>
          </thead>
          <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td:not(:first-child)]:text-right">
            <tr>
              <td>Paid each month</td>
              <td>{moneyExact(now.monthlyBudget)}</td>
              <td>{moneyExact(plan.monthlyBudget)}</td>
            </tr>
            <tr>
              <td>Debt-free</td>
              <td>{now.paidOff ? monthYear(now.debtFreeDate) : "Never"}</td>
              <td>{plan.paidOff ? monthYear(plan.debtFreeDate) : "Never"}</td>
            </tr>
            <tr>
              <td>Interest</td>
              <td>{money(now.totalInterest)}</td>
              <td>{money(plan.totalInterest)}</td>
            </tr>
            <tr>
              <td>Transfer fee</td>
              <td>–</td>
              <td>{money(fee)}</td>
            </tr>
            <tr className="font-semibold">
              <td>Interest and fees</td>
              <td>{money(costNow)}</td>
              <td className={saved >= 0 ? "text-good" : "text-warn"}>{money(costBt)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Moving: {movedNames.join(", ")}.</p>
      </div>

      {promoEnd && (
        <div className={card}>
          <h2 className="mb-2 font-semibold">When the {promo} ends</h2>
          <p className="text-sm text-muted">
            {leftAtEnd > 0 ? (
              <>
                At this budget,{" "}
                <strong className="num text-warn">{money(leftAtEnd)} is still owing</strong> when
                the {promo} ends in {monthYear(promoEnd)}, then it&apos;s charged{" "}
                {ratePct(transfer.revertRate)}. Paying more each month, or putting the transfer card
                first with &ldquo;My order&rdquo;, can clear it in time.
              </>
            ) : (
              <>
                At this budget the card is clear by {clearedBy ? monthYear(clearedBy) : "then"},
                before the {promo} ends in {monthYear(promoEnd)}.
                {minDebt && (minDebt.owingWhenPromoEnds ?? 0) > 0 && (
                  <>
                    {" "}
                    If you only paid the minimums ({moneyExact(minimumsOnly.monthlyBudget)} a
                    month),{" "}
                    <strong className="num text-warn">
                      {money(minDebt.owingWhenPromoEnds ?? 0)} would still be owing
                    </strong>{" "}
                    then, charged {ratePct(transfer.revertRate)}.
                  </>
                )}
              </>
            )}
          </p>
        </div>
      )}
    </>
  );
}
