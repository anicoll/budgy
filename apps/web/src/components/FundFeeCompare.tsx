"use client";

import {
  annualFee,
  type Cents,
  compareFundFees,
  type PersonProjection,
  type SuperInput,
} from "@budgy/engine";
import { useMemo, useState } from "react";
import { MoneyField, NumberField } from "@/components/fields";
import { money } from "@/lib/format";
import type { FeeCompareRow, SuperState } from "@/lib/superState";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const YOURSUPER_URL =
  "https://www.ato.gov.au/calculators-and-tools/super-yoursuper-comparison-tool";
const toCents = (dollars: number) => Math.round(dollars * 100) as Cents;

const FUNDS = [
  { side: "a", label: "Fund A", note: "your fund now", color: "var(--series-b)" },
  { side: "b", label: "Fund B", note: "to compare", color: "var(--series-a)" },
] as const;

/**
 * Two funds' fees side by side, run through the same projection. Fund A starts
 * from the fees already entered for the fund that gets the employer
 * contributions; Fund B starts the same, so nothing is made up.
 */
export function FundFeeCompare({
  input,
  state,
  people,
  onChange,
}: {
  input: SuperInput;
  state: SuperState;
  people: PersonProjection[];
  onChange: (v: FeeCompareRow) => void;
}) {
  const [picked, setPicked] = useState<string>();
  const options = people.filter((p) => p.yearsToRetire > 0);
  const person = options.find((p) => p.id === picked) ?? options[0];
  const row = state.people.find((p) => p.id === person?.id);
  const account = row?.accounts.find((a) => a.employer) ?? row?.accounts[0];
  const current = account && { fixed: account.feeFixed, pct: account.feePct };
  const fees = state.fees ?? (current && { a: current, b: current });

  const result = useMemo(() => {
    if (!(person && account && fees)) return null;
    const toFees = (f: { fixed: number; pct: number }) => ({
      fixed: toCents(f.fixed),
      pct: f.pct / 100,
    });
    return compareFundFees(input, person.id, account.id, toFees(fees.a), toFees(fees.b));
  }, [input, person, account, fees]);
  if (!(person && account && fees && row)) return null;

  const set = (side: "a" | "b", patch: Partial<{ fixed: number; pct: number }>) =>
    onChange({ ...fees, [side]: { ...fees[side], ...patch } });
  const balance = toCents(account.balance);
  const peak = result ? Math.max(result.a, result.b, 1) : 1;
  const diff = result?.difference ?? 0;

  return (
    <div className={card}>
      <h2 className="mb-1 font-semibold">Compare fees</h2>
      <p className="mb-3 text-sm text-muted">What a difference in fees adds up to by retirement.</p>
      {options.length > 1 && (
        <fieldset className="mb-3 flex flex-wrap gap-2">
          <legend className="sr-only">Whose super</legend>
          {options.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === person.id}
              className={`rounded-full border px-3 py-1.5 text-sm ${p.id === person.id ? "border-accent bg-accent text-on-accent" : "border-border hover:border-accent"}`}
              onClick={() => setPicked(p.id)}
            >
              {p.name}
            </button>
          ))}
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {FUNDS.map((f) => (
          <fieldset key={f.side} className="rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-medium" style={{ color: f.color }}>
              {f.label}, {f.note}
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <MoneyField
                label="Admin fee a year"
                value={fees[f.side].fixed}
                onChange={(v) => v !== undefined && set(f.side, { fixed: v })}
              />
              <NumberField
                label="Percent of balance"
                suffix="%"
                min={0}
                max={5}
                step={0.01}
                value={fees[f.side].pct}
                onChange={(v) => v !== undefined && set(f.side, { pct: v })}
              />
            </div>
            <p className="num mt-2 text-sm text-muted">
              About{" "}
              {money(
                annualFee(
                  { fixed: toCents(fees[f.side].fixed), pct: fees[f.side].pct / 100 },
                  balance,
                ),
              )}{" "}
              a year on a {money(balance)} balance
            </p>
          </fieldset>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        Find these on your fund&apos;s PDS or annual statement, as &quot;administration fees&quot;
        and &quot;investment fees and costs&quot;. Add them together for the percent. Both funds use
        the return you entered for the account, so it should be the return before these fees.
      </p>

      {result && (
        <div className="mt-4 border-t border-border pt-4" aria-live="polite">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {diff === 0 ? (
              <span className="text-lg font-medium">
                No difference yet. Change Fund B&apos;s fees to compare.
              </span>
            ) : (
              <>
                <span className={`num text-3xl font-bold ${diff > 0 ? "text-good" : "text-warn"}`}>
                  {money(Math.abs(diff))}
                </span>
                <span className="text-lg">
                  {diff > 0 ? "more" : "less"} at {row.retireAge} with Fund B, in today&apos;s
                  dollars
                </span>
              </>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {FUNDS.map((f) => {
              const v = result[f.side];
              return (
                <div key={f.side} className="flex items-center gap-3">
                  <span className="w-14 text-sm">{f.label}</span>
                  <div className="h-5 flex-1 rounded bg-surface-container-high">
                    <div
                      className="h-5 rounded"
                      style={{ width: `${(v / peak) * 100}%`, background: f.color }}
                    />
                  </div>
                  <span className="num w-24 text-right">{money(v)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            Same balance, contributions and returns before fees, so only the fees differ.
            {row.accounts.length > 1 && " Other accounts are left as they are."} Fees are one part
            of choosing a fund; returns, insurance and service matter too. Compare funds with the
            ATO&apos;s{" "}
            <a className="text-accent hover:underline" href={YOURSUPER_URL}>
              YourSuper comparison tool
            </a>
            . General information only, not financial advice.
          </p>
        </div>
      )}
    </div>
  );
}
