"use client";

import {
  atoResidual,
  type CarKind,
  type Cents,
  calculateNovatedLease,
  compareLeaseTerms,
  impliedLeaseRate,
  leaseRental,
  type NovatedLeaseResult,
  validateLease,
} from "@budgy/engine";
import { useMemo, useState } from "react";
import { DateField, MoneyField, NumberField, SelectField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { LeaseCompare } from "@/components/LeaseCompare";
import { SavedBar } from "@/components/SavedBar";
import { money, moneyExact } from "@/lib/format";
import { LEASE_PEOPLE } from "@/lib/household";
import {
  decodeLeaseState,
  encodeLeaseState,
  LEASE_YEARS,
  type LeasePer,
  type LeaseState,
  leaseStateFromPay,
  switchQuoteAmounts,
  toLeaseInput,
} from "@/lib/leaseState";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox, Select } from "./ui";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const LEASE_SAVED: SavedConfig<LeaseState> = {
  tool: "lease",
  // The same start on the server and in the browser; saved pay comes in after.
  initial: () => leaseStateFromPay(null),
  decode: (q) => decodeLeaseState(q),
  encode: encodeLeaseState,
  people: LEASE_PEOPLE,
  adopt: (s, { data, fresh }) =>
    fresh && data.tools.pay ? { ...s, year: leaseStateFromPay(data.tools.pay).year } : s,
};

const SHOW: { value: LeasePer; label: string; per: string; n: number }[] = [
  { value: "weekly", label: "Week", per: "a week", n: 52 },
  { value: "fortnightly", label: "Fortnight", per: "a fortnight", n: 26 },
  { value: "monthly", label: "Month", per: "a month", n: 12 },
];
const CARS: { value: CarKind; label: string }[] = [
  { value: "ev", label: "Electric" },
  { value: "phev", label: "Plug-in hybrid" },
  { value: "ice", label: "Petrol or diesel" },
];
const TERMS = [1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} yr` }));

const pct = (v: number, digits = 2) =>
  `${(v * 100).toLocaleString("en-AU", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
const hasQuoteExtras = (s: LeaseState) =>
  s.establishmentFee > 0 || s.financedFees > 0 || s.otherMonthly > 0 || s.inAdvance;
const years = (n: number) => `${n} year${n === 1 ? "" : "s"}`;

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

export function LeaseCalculator() {
  const saved = useSavedState(LEASE_SAVED);
  const { state, setState } = saved;
  const set = (patch: Partial<LeaseState>) => setState((s) => ({ ...s, ...patch }));

  const input = useMemo(() => toLeaseInput(state), [state]);
  const errors = useMemo(() => validateLease(input), [input]);
  const result = useMemo(
    () => (errors.length ? null : safe(() => calculateNovatedLease(input))),
    [input, errors],
  );
  const terms = useMemo(
    () => (errors.length ? null : safe(() => compareLeaseTerms(input))),
    [input, errors],
  );

  const show = SHOW.find((s) => s.value === state.show) ?? SHOW[1];
  const per = result ? result.perPay[show.value] : null;
  // From the rounded per-pay figures, so the sentence adds up.
  const taxSavedPer = per ? per.preTax + per.postTax - per.cost : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Novated lease calculator
        </h1>
        <p className="mt-1 max-w-2xl text-muted">
          What a car really costs out of your pay on a novated lease, and whether that beats a car
          loan or paying cash. Uses the ATO&apos;s {state.year} tax rates and the current FBT rules.
        </p>
        <SavedBar saved={saved} />
      </header>

      {result && per && (
        <div
          className="sticky top-[var(--header-h)] z-10 -mx-4 mb-4 flex items-center justify-between gap-3 bg-primary-container px-4 py-3 text-on-primary-container lg:hidden"
          aria-live="polite"
        >
          <div>
            <p className="text-xs opacity-75">Take-home pay drops by</p>
            <p className="num text-2xl font-semibold">{moneyExact(per.cost)}</p>
            <p className="text-xs opacity-75">{show.per}</p>
          </div>
          <div className="flex flex-col gap-1 text-xs opacity-90">
            <span aria-hidden>Show per</span>
            <Select<LeasePer>
              ariaLabel="Show per"
              triggerClassName="rounded-lg border border-on-primary-container/20 bg-surface/60 px-2 py-2 text-base text-on-primary-container"
              value={state.show}
              onChange={(show) => set({ show })}
              options={SHOW}
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <Inputs state={state} set={set} setAll={setState} result={result} />

        <section className="min-w-0 space-y-4" aria-label="Results">
          {errors.length > 0 && (
            <div className={`${card} text-warn`} role="alert">
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}
          {result && per && (
            <>
              <div className={card}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-muted">Your take-home pay drops by</p>
                    <p className="num mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
                      {moneyExact(per.cost)}{" "}
                      <span className="text-lg font-medium text-muted">{show.per}</span>
                    </p>
                    <p className="mt-1.5 max-w-xl text-sm text-muted">
                      {per.postTax > 0 ? (
                        <>
                          {moneyExact(per.preTax)} {show.per} comes out before tax and{" "}
                          {moneyExact(per.postTax)} after tax to cover FBT. You save{" "}
                          {moneyExact(taxSavedPer)} in tax.
                        </>
                      ) : (
                        <>
                          {moneyExact(per.preTax)} {show.per} comes out before tax, and you save{" "}
                          {moneyExact(taxSavedPer)} in tax. That covers the car, running costs and
                          fees.
                        </>
                      )}
                    </p>
                  </div>
                  <div className="hidden lg:block">
                    <Segmented
                      pill
                      label="Show amounts per"
                      options={SHOW.map(({ value, label }) => ({ value, label }))}
                      value={state.show}
                      onChange={(v) => set({ show: v })}
                    />
                  </div>
                </div>
                <FbtBadge result={result} />
                <Breakdown result={result} />
                <Warnings result={result} />
              </div>
              <Ownership result={result} loanPct={state.loanPct} />
              <LeaseCompare state={state} set={set} result={result} />
              {terms && <Terms rows={terms} current={state.termYears} />}
              <QuoteCheck state={state} set={set} result={result} />
              <Sources result={result} year={state.year} />
            </>
          )}
          <GoodToKnow tool="lease" />
        </section>
      </div>
    </main>
  );
}

function Inputs({
  state,
  set,
  setAll,
  result,
}: {
  state: LeaseState;
  set: (p: Partial<LeaseState>) => void;
  setAll: (f: (s: LeaseState) => LeaseState) => void;
  result: NovatedLeaseResult | null;
}) {
  const min = atoResidual(state.termYears);
  return (
    <div className="space-y-4 self-start">
      <section className={`${card} space-y-4`} aria-label="Your pay">
        <h2 className="font-semibold">Your pay</h2>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField
            label="Salary a year"
            hint="Before tax, without super"
            value={state.salary}
            onChange={(v) => set({ salary: v ?? 0 })}
          />
          <SelectField
            label="Tax year"
            value={state.year}
            onChange={(v) => set({ year: v })}
            options={LEASE_YEARS.map((y) => ({ value: y, label: y }))}
          />
        </div>
        <Check
          label="I have a HELP or other study loan"
          checked={state.studyLoan}
          onChange={(v) => set({ studyLoan: v })}
        />
        <Check
          label="I have private hospital cover"
          hint="Without it, the car's reportable fringe benefits can bring on the Medicare levy surcharge"
          checked={state.hospitalCover}
          onChange={(v) => set({ hospitalCover: v })}
        />
        <p className="text-xs text-muted">
          More pay options are in the <a href="../pay/">pay calculator</a>.
        </p>
      </section>

      <section className={`${card} space-y-4`} aria-label="The car">
        <h2 className="font-semibold">The car</h2>
        <Segmented
          label="Type of car"
          options={CARS}
          value={state.car}
          onChange={(v) => set({ car: v })}
        />
        <div className="grid grid-cols-2 gap-3">
          <MoneyField
            label="Price"
            hint="With GST, before on-roads"
            value={state.price}
            onChange={(v) => set({ price: v ?? 0 })}
          />
          <MoneyField
            label="On-road costs"
            hint="Stamp duty and first rego"
            value={state.onRoads}
            onChange={(v) => set({ onRoads: v ?? 0 })}
          />
        </div>
      </section>

      <section className={`${card} space-y-4`} aria-label="The lease">
        <h2 className="font-semibold">The lease</h2>
        <div>
          <p className="mb-1 text-sm font-medium">Term</p>
          <Segmented
            label="Lease term in years"
            options={TERMS}
            value={String(state.termYears)}
            onChange={(v) => set({ termYears: Number(v) })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Interest rate"
            suffix="%"
            min={0}
            max={30}
            step={0.01}
            value={state.ratePct}
            onChange={(v) => set({ ratePct: v ?? 0 })}
          />
          <MoneyField
            label="Management fee"
            hint={state.quoteAmounts ? "A month, no GST" : "A year, with GST"}
            value={state.fee}
            onChange={(v) => set({ fee: v ?? 0 })}
          />
          <DateField label="Lease starts" value={state.start} onChange={(v) => set({ start: v })} />
          <NumberField
            label="Residual"
            suffix="%"
            min={0}
            max={99}
            step={0.01}
            optional
            placeholder={(min * 100).toFixed(2)}
            hint={
              state.residualPct === undefined
                ? `ATO minimum for ${years(state.termYears)}`
                : `ATO minimum is ${pct(min)}`
            }
            value={state.residualPct}
            onChange={(v) => set({ residualPct: v })}
          />
        </div>
        <details className="group" open={hasQuoteExtras(state)}>
          <summary className="cursor-pointer text-sm font-medium text-accent">
            Fees and charges from a quote
          </summary>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MoneyField
              label="Establishment fee"
              hint="One-off, spread over the lease"
              value={state.establishmentFee}
              onChange={(v) => set({ establishmentFee: v ?? 0 })}
            />
            <MoneyField
              label="Fees financed"
              hint="Such as PPSR or brokerage"
              value={state.financedFees}
              onChange={(v) => set({ financedFees: v ?? 0 })}
            />
            <MoneyField
              label="Other charges a month"
              hint="Such as a luxury car charge"
              value={state.otherMonthly}
              onChange={(v) => set({ otherMonthly: v ?? 0 })}
            />
          </div>
          <div className="mt-3">
            <Check
              label="Payments at the start of each month"
              hint="Some providers charge rentals in advance"
              checked={state.inAdvance}
              onChange={(v) => set({ inAdvance: v })}
            />
          </div>
        </details>
      </section>

      <section className={`${card} space-y-4`} aria-label="Running costs">
        <h2 className="font-semibold">Running costs</h2>
        <Segmented
          label="Running costs are"
          options={[
            { value: "year", label: "A year, with GST" },
            { value: "quote", label: "A month, no GST" },
          ]}
          value={state.quoteAmounts ? "quote" : "year"}
          onChange={(v) => setAll((s) => switchQuoteAmounts(s, v === "quote"))}
        />
        <div className="grid grid-cols-2 gap-3">
          <MoneyField
            label={
              state.car === "ev" ? "Charging" : state.car === "phev" ? "Fuel and charging" : "Fuel"
            }
            value={state.energy}
            onChange={(v) => set({ energy: v ?? 0 })}
          />
          <MoneyField
            label="Registration"
            value={state.rego}
            onChange={(v) => set({ rego: v ?? 0 })}
          />
          <MoneyField
            label="Insurance"
            value={state.insurance}
            onChange={(v) => set({ insurance: v ?? 0 })}
          />
          <MoneyField
            label="Servicing and tyres"
            value={state.servicing}
            onChange={(v) => set({ servicing: v ?? 0 })}
          />
        </div>
        <p className="text-xs text-muted">
          {state.quoteAmounts
            ? "As a provider's quote shows its budgets, a month without GST"
            : "Include GST. Your employer claims it back, so the lease packages them without it"}
          {result ? ` (${moneyExact(result.runningPackaged)} a year packaged)` : ""}.
        </p>
      </section>

      <section className={`${card} space-y-4`} aria-label="Compare with">
        <h2 className="font-semibold">Compare with</h2>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Car loan rate"
            suffix="%"
            min={0}
            max={30}
            step={0.01}
            optional
            placeholder="None"
            value={state.loanPct}
            onChange={(v) => set({ loanPct: v })}
          />
          <NumberField
            label="Savings rate"
            hint="What cash would earn instead"
            suffix="%"
            min={0}
            max={30}
            step={0.01}
            value={state.savingsPct}
            onChange={(v) => set({ savingsPct: v ?? 0 })}
          />
        </div>
      </section>
    </div>
  );
}

function FbtBadge({ result }: { result: NovatedLeaseResult }) {
  const { fbt } = result;
  const y = result.years[0];
  const exempt = fbt.treatment === "exempt";
  let title: string;
  let text: string;
  const contribution = `To keep the FBT bill at nil, ${moneyExact(y.postTax)} a year comes from your pay after tax.`;
  const reportable =
    y.reportable > 0
      ? `Your income statement will show ${moneyExact(y.reportable)} of reportable fringe benefits. It isn't taxed, but it counts for the Medicare levy surcharge, HELP repayments and some Centrelink tests.`
      : "";
  switch (fbt.reason) {
    case "ev":
      title = "Electric car: no fringe benefits tax";
      text = `Your lease keeps this for its whole term. ${reportable}`;
      break;
    case "phev-before-april-2025":
      title = "Plug-in hybrid: no fringe benefits tax";
      text = `Leases committed to before 1 April 2025 keep the exemption. ${reportable}`;
      break;
    case "ev-discount-over-75k":
    case "ev-discount-all":
      title = "Electric car: 25% off fringe benefits tax (proposed)";
      text = `The 2026-27 Budget proposed this for ${
        fbt.reason === "ev-discount-all"
          ? "every EV lease from 1 April 2029"
          : "EVs over $75,000 leased from 1 April 2027"
      }. It isn't law yet. ${contribution} ${reportable}`;
      break;
    case "ev-over-cap":
      title = `Electric car over the ${money(result.carRules.lctFuelEfficient)} price cap: FBT applies`;
      text = `${contribution} That's standard, and it's why the lease saves less.`;
      break;
    case "phev":
      title = "Plug-in hybrid: FBT applies";
      text = `Plug-in hybrids lost the exemption for leases from 1 April 2025. ${contribution}`;
      break;
    default:
      title = "Petrol or diesel: FBT applies";
      text = `${contribution} That's 20% of the price, and it's why a lease saves far less on a petrol car.`;
  }
  return (
    <div
      className={`mt-5 flex flex-col gap-1 rounded-lg px-4 py-3.5 ${
        exempt
          ? "bg-[color-mix(in_srgb,var(--good)_12%,var(--surface))]"
          : "bg-[color-mix(in_srgb,var(--warn)_12%,var(--surface))]"
      }`}
    >
      <strong className={exempt ? "text-good" : "text-warn"}>{title}</strong>
      <span className="text-sm">{text.trim()}</span>
    </div>
  );
}

function Breakdown({ result }: { result: NovatedLeaseResult }) {
  const y = result.years[0];
  const rows: [string, Cents, string?][] = [
    ["Lease payments, no GST", (result.monthlyRental * 12) as Cents],
    ["Running costs, no GST", result.runningPackaged],
    ["Management fee, no GST", result.managementFeePackaged],
    ...(result.otherPackaged > 0
      ? [["Establishment fee and other charges", result.otherPackaged] as [string, Cents]]
      : []),
    ["From your pay before tax", y.preTax],
    ["From your pay after tax, to cover FBT", y.postTax],
    ["Less tax and Medicare you save", -y.taxSaved as Cents, "text-good"],
  ];
  const fn = (c: number) => moneyExact(Math.round(c / 26));
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="num w-full min-w-[420px] border-collapse text-right">
        <thead>
          <tr className="text-sm text-muted">
            <th className="border-b border-border py-2 text-left font-medium">
              {result.termYears > 4 ? "Years 1 to 4 of the lease" : "Each year of the lease"}
            </th>
            <th className="border-b border-border py-2 font-medium">A fortnight</th>
            <th className="border-b border-border py-2 font-medium">A year</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, v, cls]) => (
            <tr key={label} className={cls}>
              <td className="border-b border-[var(--grid)] py-2.5 text-left text-text">{label}</td>
              <td className="border-b border-[var(--grid)]">{fn(v)}</td>
              <td className="border-b border-[var(--grid)]">{moneyExact(v)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="py-3 text-left">Cost to you</td>
            <td>{fn(y.cost)}</td>
            <td>{moneyExact(y.cost)}</td>
          </tr>
          <tr className="text-muted">
            <td className="border-t border-border py-2.5 text-left">
              At the end: residual {moneyExact(result.residual)} plus GST
            </td>
            <td className="border-t border-border" />
            <td className="border-t border-border">{moneyExact(result.residualWithGst)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Warnings({ result }: { result: NovatedLeaseResult }) {
  const lines = result.warnings.flatMap((w) => {
    switch (w.kind) {
      case "luxury-car-tax":
        return [`The price includes about ${moneyExact(w.amount)} of luxury car tax.`];
      case "residual-below-ato":
        return [
          `The residual is below the ATO minimum of ${pct(w.minimum)}, so a provider won't offer it.`,
        ];
      case "base-value-reduced": {
        const y5 = result.years[4];
        return [
          `In year 5 the FBT value of the car drops by a third, so the after-tax part falls to ${moneyExact(y5.postTax)} and the cost to ${moneyExact(y5.cost)} that year.`,
        ];
      }
      case "rules-carried-forward":
        return [`Car thresholds for this date aren't out yet, so these use ${w.year}'s.`];
      case "packaging-too-big":
        return ["The lease costs more than your salary can cover before tax."];
      default:
        return [];
    }
  });
  if (!lines.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-sm text-warn">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

function Ownership({ result, loanPct }: { result: NovatedLeaseResult; loanPct?: number }) {
  const bars = [
    { label: "Novated lease", total: result.lease.total, lease: true },
    { label: "Pay cash", total: result.cash.total, lease: false },
    ...(result.loan && loanPct !== undefined
      ? [{ label: `Car loan at ${loanPct}%`, total: result.loan.total, lease: false }]
      : []),
  ];
  const max = Math.max(...bars.map((b) => b.total));
  const vsCash = result.cash.total - result.lease.total;
  const vsLoan = result.loan ? result.loan.total - result.lease.total : null;
  const verdict =
    vsCash >= 0
      ? `The lease saves you ${money(vsCash)} over paying cash`
      : `The lease costs ${money(-vsCash)} more than paying cash`;
  const loanPart =
    vsLoan === null
      ? ""
      : vsLoan >= 0
        ? `, and ${money(vsLoan)} over a car loan`
        : `, and ${money(-vsLoan)} more than a car loan`;
  return (
    <div className={card}>
      <h2 className="font-semibold">To own the car after {years(result.termYears)}</h2>
      <p className="mt-1 text-sm text-muted">
        Everything out of your pocket, running costs included, so each one ends the same way.
      </p>
      <div className="mt-4 space-y-3">
        {bars.map((b) => (
          <div
            key={b.label}
            className="grid grid-cols-[110px_minmax(0,1fr)_90px] items-center gap-3 sm:grid-cols-[150px_minmax(0,1fr)_110px]"
          >
            <span className="text-sm font-medium">{b.label}</span>
            <div className="h-5 overflow-hidden rounded-md bg-[var(--grid)]" aria-hidden="true">
              <div
                className="h-full rounded-md"
                style={{
                  width: `${((b.total / max) * 100).toFixed(1)}%`,
                  background: b.lease ? "var(--good)" : "var(--series-base)",
                }}
              />
            </div>
            <span className="num text-right font-semibold">{money(b.total)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4">
        <strong>
          {verdict}
          {loanPart}
        </strong>
        .{" "}
        {result.cash.lostInterest > 0 && (
          <span className="text-muted">
            Paying cash counts {money(result.cash.lostInterest)} of interest your savings would have
            earned after tax.
          </span>
        )}
      </p>
    </div>
  );
}

function Terms({ rows, current }: { rows: NovatedLeaseResult[]; current: number }) {
  return (
    <div className={card}>
      <h2 className="font-semibold">Shorter or longer lease</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="num w-full min-w-[460px] border-collapse text-right">
          <thead>
            <tr className="text-sm text-muted">
              <th className="border-b border-border py-2 text-left font-medium">Term</th>
              <th className="border-b border-border py-2 font-medium">Residual</th>
              <th className="border-b border-border py-2 font-medium">Cost a fortnight</th>
              <th className="border-b border-border py-2 font-medium">Total to own</th>
              <th className="border-b border-border py-2 font-medium">Saves vs cash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.termYears} className={r.termYears === current ? "font-semibold" : ""}>
                <td className="border-b border-[var(--grid)] py-2.5 text-left">
                  {years(r.termYears)}
                </td>
                <td className="border-b border-[var(--grid)]">{pct(r.residualRate)}</td>
                <td className="border-b border-[var(--grid)]">
                  {moneyExact(r.perPay.fortnightly.cost)}
                </td>
                <td className="border-b border-[var(--grid)]">{money(r.lease.total)}</td>
                <td className="border-b border-[var(--grid)]">
                  {money(r.cash.total - r.lease.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted">
        Each term at the ATO&apos;s minimum residual, with the first year&apos;s cost.
      </p>
    </div>
  );
}

function QuoteCheck({
  state,
  set,
  result,
}: {
  state: LeaseState;
  set: (p: Partial<LeaseState>) => void;
  result: NovatedLeaseResult;
}) {
  const [opened, setOpen] = useState(false);
  // Saved inputs load after the first render, so open for a saved quote then too.
  const open = opened || state.quoteRental !== undefined;
  const financed = state.quoteFinanced ?? result.financed / 100;
  const residual = state.quoteResidual ?? result.residual / 100;
  const months = state.termYears * 12;
  const rental = state.quoteRental;
  const c = (d: number) => Math.round(d * 100) as Cents;
  const implied =
    rental === undefined
      ? null
      : impliedLeaseRate(c(financed), c(residual), months, c(rental), state.inAdvance);
  const bench = leaseRental(c(financed), c(residual), state.ratePct / 100, months, state.inAdvance);
  const extra = rental === undefined ? 0 : c(rental) - bench;
  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Check a lease quote</h2>
        {!open && (
          <button
            type="button"
            className="text-sm font-medium text-accent hover:underline"
            onClick={() => setOpen(true)}
          >
            Check one
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Providers rarely show the interest rate. Put in the finance figures from your quote and
        we&apos;ll work it out.
      </p>
      {open && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <MoneyField
              label="Amount financed"
              hint="Usually the price less GST, plus on-roads"
              optional
              placeholder={moneyExact(result.financed).replace("$", "")}
              value={state.quoteFinanced}
              onChange={(v) => set({ quoteFinanced: v })}
            />
            <MoneyField
              label="Residual, no GST"
              optional
              placeholder={moneyExact(result.residual).replace("$", "")}
              value={state.quoteResidual}
              onChange={(v) => set({ quoteResidual: v })}
            />
            <MoneyField
              label="Finance payment a month"
              hint="Lease only, without running costs or fees"
              optional
              value={state.quoteRental}
              onChange={(v) => set({ quoteRental: v })}
            />
          </div>
          <p className="mt-2 text-xs text-muted">Over {years(state.termYears)}, the term above.</p>
          {rental !== undefined && (
            <div className="mt-4 border-t border-[var(--grid)] pt-4" aria-live="polite">
              {implied === null ? (
                <p className="text-warn">
                  That payment doesn&apos;t fit any rate from 0% to 50%. Check the amount financed
                  and residual.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted">Your quote&apos;s interest rate</p>
                  <p className="num text-3xl font-semibold">{pct(implied)}</p>
                  {Math.abs(extra) >= 100 && (
                    <p className="mt-2">
                      <strong>
                        {moneyExact(Math.abs(extra))} a month {extra > 0 ? "more" : "less"} than at{" "}
                        {state.ratePct}%
                      </strong>
                      <span className="text-muted">
                        , {moneyExact(Math.abs(extra) * months)} over the lease, before tax.
                        {extra > 0 && " Worth asking for a better rate or a second quote."}
                      </span>
                    </p>
                  )}
                </>
              )}
              <p className="mt-2 text-xs text-muted">
                {state.inAdvance
                  ? "Payments at the start of each month, as set in the lease above."
                  : "Payments at the end of each month. If your provider charges at the start, tick that in the lease above."}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Sources({ result, year }: { result: NovatedLeaseResult; year: string }) {
  return (
    <p className="text-sm text-muted">
      Uses the ATO&apos;s {year} tax rates, Medicare levy and HELP thresholds, the{" "}
      {result.carRules.year} <a href={result.carRules.sources[1]}>car limit</a> for the GST your
      employer claims back ({moneyExact(result.gstCredit)} here), the{" "}
      <a href={result.carRules.sources[0]}>luxury car tax thresholds</a>, and the FBT statutory
      formula (20% of the car&apos;s price) with the employee contribution method, which almost
      every provider uses. Later years use this year&apos;s tax rates. Not financial advice: check a
      real quote before you sign.
    </p>
  );
}

function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Checkbox
      className="flex min-h-7 cursor-pointer gap-3"
      isSelected={checked}
      onChange={(v) => onChange(v)}
    >
      <span>
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </Checkbox>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  pill,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  pill?: boolean;
}) {
  if (pill) {
    return (
      <fieldset
        aria-label={label}
        className="m-0 flex min-w-0 rounded-full border border-border bg-surface p-0.5 text-sm"
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3.5 py-1.5 ${
              o.value === value
                ? "bg-accent font-semibold text-on-accent"
                : "text-muted hover:text-text"
            }`}
          >
            {o.label}
          </button>
        ))}
      </fieldset>
    );
  }
  return (
    <fieldset
      aria-label={label}
      className="m-0 grid min-w-0 overflow-hidden rounded-lg border border-border p-0 text-sm"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 px-1 py-2 ${
            o.value === value ? "bg-accent font-semibold text-on-accent" : "bg-surface hover:bg-bg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}
