"use client";

import {
  atoResidual,
  type CarKind,
  type Cents,
  calculateNovatedLease,
  compareLeaseTerms,
  impliedLeaseRate,
  leaseRental,
  leaveScenario,
  type NovatedLeaseInput,
  type NovatedLeaseResult,
  validateLease,
} from "@budgy/engine";
import { useMemo, useState } from "react";
import { DateField, MoneyField, NumberField, SelectField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { compareLine, LeaseCompare } from "@/components/LeaseCompare";
import { NextSteps } from "@/components/NextSteps";
import {
  AnswerCard,
  AnswerRow,
  Detail,
  Disclosure,
  EditSheet,
  IdeaCard,
  Ideas,
  SummaryRow,
  SummaryRows,
  ToolHeader,
  ToolPage,
  ToolSection,
  toolCard,
  useEditSheet,
  useIdea,
} from "@/components/tool";
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
import { Checkbox } from "./ui";

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
  const { ref: sheet, open: edit } = useEditSheet();
  const { idea, toggle } = useIdea<"own" | "cars" | "terms" | "quote">();

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

  const vsCash = result ? result.cash.total - result.lease.total : 0;
  const vsLoan = result?.loan ? result.loan.total - result.lease.total : null;
  const bestTerm = terms?.reduce((a, b) =>
    b.cash.total - b.lease.total > a.cash.total - a.lease.total ? b : a,
  );
  const carsLine = result ? compareLine(state, result) : null;
  const quoteRate = result ? quoteImplied(state, result) : null;
  const runningTotal = state.energy + state.rego + state.insurance + state.servicing;

  return (
    <ToolPage>
      <ToolHeader
        title="Novated lease calculator"
        intro={`What a car really costs out of your pay, and whether that beats a car loan or cash. Uses the ATO's ${state.year} tax rates.`}
        saved={saved}
      />

      {!result || !per ? (
        <div className={`${toolCard} text-warn`} role="alert">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
          <button type="button" onClick={() => edit()} className="mt-2 text-accent underline">
            Edit your numbers
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <AnswerRow>
            <AnswerCard label="Your take-home pay drops by">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <p className="num text-4xl font-bold tracking-tight sm:text-5xl">
                  {moneyExact(per.cost)}{" "}
                  <span className="text-lg font-medium text-muted">{show.per}</span>
                </p>
                <Segmented
                  pill
                  label="Show amounts per"
                  options={SHOW.map(({ value, label }) => ({ value, label }))}
                  value={state.show}
                  onChange={(v) => set({ show: v })}
                />
              </div>
              <p className="text-sm">
                {per.postTax > 0 ? (
                  <>
                    {moneyExact(per.preTax)} {show.per} comes out before tax and{" "}
                    {moneyExact(per.postTax)} after tax to cover FBT. You save{" "}
                    {moneyExact(taxSavedPer)} in tax.
                  </>
                ) : (
                  <>
                    {moneyExact(per.preTax)} {show.per} comes out before tax, and you save{" "}
                    {moneyExact(taxSavedPer)} in tax. That covers the car, running costs and fees.
                  </>
                )}
              </p>
              <Warnings result={result} />
            </AnswerCard>
            <div className={`${toolCard} flex min-w-0 flex-col gap-4`}>
              <FbtBadge result={result} />
              <div className="divide-y divide-border">
                <CompareRow
                  label="paying cash"
                  diff={vsCash}
                  note={
                    result.cash.lostInterest > 0
                      ? `Counts ${money(result.cash.lostInterest)} of savings interest`
                      : undefined
                  }
                />
                {vsLoan !== null && state.loanPct !== undefined && (
                  <CompareRow label={`a car loan at ${state.loanPct}%`} diff={vsLoan} />
                )}
              </div>
            </div>
          </AnswerRow>

          <ToolSection id="numbers-h" title="Your numbers">
            <SummaryRows>
              <SummaryRow
                title="Your pay"
                hint={`${money(state.salary * 100)} a year · ${state.year}${
                  state.studyLoan ? " · study loan" : ""
                }`}
                onClick={() => edit("lease-pay")}
              />
              <SummaryRow
                title="The car"
                hint={`${CARS.find((c) => c.value === state.car)?.label} · ${money(
                  state.price * 100,
                )} + ${money(state.onRoads * 100)} on-roads`}
                onClick={() => edit("lease-car")}
              />
              <SummaryRow
                title="The lease"
                hint={`${years(state.termYears)} · ${state.ratePct}% · residual ${pct(
                  result.residualRate,
                )}`}
                onClick={() => edit("lease-lease")}
              />
              <SummaryRow
                title="Running costs"
                hint={`${money(runningTotal * 100)} ${state.quoteAmounts ? "a month" : "a year"}`}
                onClick={() => edit("lease-running")}
              />
              <SummaryRow
                title="Compare with"
                hint={`${
                  state.loanPct === undefined ? "no car loan" : `car loan ${state.loanPct}%`
                } · savings ${state.savingsPct}%`}
                onClick={() => edit("lease-compare")}
              />
            </SummaryRows>
          </ToolSection>

          <Ideas
            cards={
              <>
                <IdeaCard
                  title={`To own the car after ${years(result.termYears)}`}
                  open={idea === "own"}
                  onClick={() => toggle("own")}
                >
                  {vsCash >= 0 ? (
                    <>
                      The lease saves <strong className="num text-good">{money(vsCash)}</strong>{" "}
                      over cash.
                    </>
                  ) : (
                    <>
                      The lease costs <strong className="num text-warn">{money(-vsCash)}</strong>{" "}
                      more than cash.
                    </>
                  )}
                </IdeaCard>
                <IdeaCard
                  title="Compare a second car"
                  open={idea === "cars"}
                  onClick={() => toggle("cars")}
                >
                  {carsLine ?? "Put two cars side by side on the same pay."}
                </IdeaCard>
                <IdeaCard
                  title="Shorter or longer lease"
                  open={idea === "terms"}
                  onClick={() => toggle("terms")}
                >
                  {bestTerm ? (
                    <>
                      Saves most over {years(bestTerm.termYears)}:{" "}
                      <strong className="num">
                        {money(bestTerm.cash.total - bestTerm.lease.total)}
                      </strong>{" "}
                      against cash.
                    </>
                  ) : (
                    "See each term from 1 to 5 years."
                  )}
                </IdeaCard>
                <IdeaCard
                  title="Got a quote?"
                  open={idea === "quote"}
                  onClick={() => toggle("quote")}
                >
                  {quoteRate !== null
                    ? `Your quote works out to ${pct(quoteRate)} interest.`
                    : "Check the interest rate hidden in a provider's quote."}
                </IdeaCard>
              </>
            }
          >
            {idea === "own" && <Ownership result={result} loanPct={state.loanPct} />}
            {idea === "cars" && <LeaseCompare state={state} set={set} result={result} />}
            {idea === "terms" && terms && <Terms rows={terms} current={state.termYears} />}
            {idea === "quote" && <QuoteCheck state={state} set={set} result={result} />}
          </Ideas>

          <Detail>
            <Disclosure
              title={result.termYears > 4 ? "Years 1 to 4 of the lease" : "Each year of the lease"}
              hint="where the money goes"
            >
              <Breakdown result={result} />
            </Disclosure>
            <Disclosure title="If you leave your job" hint="what happens to the lease">
              <LeaveJob input={input} result={result} />
            </Disclosure>
            <Disclosure title="Good to know" hint="tips and things to check">
              <GoodToKnow tool="lease" bare />
            </Disclosure>
            <Disclosure title="How this is calculated" hint="tax, FBT and the lease">
              <Sources result={result} year={state.year} />
            </Disclosure>
          </Detail>
          <NextSteps tool="lease" className="pt-2" />
        </div>
      )}

      <EditSheet ref={sheet} title="Your lease">
        <Inputs state={state} set={set} setAll={setState} result={result} />
      </EditSheet>
    </ToolPage>
  );
}

function CompareRow({ label, diff, note }: { label: string; diff: number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <span>
        <span className="block">Compared with {label}</span>
        {note && <span className="block text-xs text-muted">{note}</span>}
      </span>
      <strong className={`num shrink-0 ${diff >= 0 ? "text-good" : "text-warn"}`}>
        {money(Math.abs(diff))} {diff >= 0 ? "better" : "worse"}
      </strong>
    </div>
  );
}

/** The interest rate a quote works out to, when the quote's payment is filled in. */
function quoteImplied(state: LeaseState, result: NovatedLeaseResult): number | null {
  if (state.quoteRental === undefined) return null;
  const c = (d: number) => Math.round(d * 100) as Cents;
  return impliedLeaseRate(
    c(state.quoteFinanced ?? result.financed / 100),
    c(state.quoteResidual ?? result.residual / 100),
    state.termYears * 12,
    c(state.quoteRental),
    state.inAdvance,
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
    <>
      <section id="lease-pay" className={`${card} scroll-mt-20 space-y-4`} aria-label="Your pay">
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

      <section id="lease-car" className={`${card} scroll-mt-20 space-y-4`} aria-label="The car">
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

      <section id="lease-lease" className={`${card} scroll-mt-20 space-y-4`} aria-label="The lease">
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

      <section
        id="lease-running"
        className={`${card} scroll-mt-20 space-y-4`}
        aria-label="Running costs"
      >
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

      <section
        id="lease-compare"
        className={`${card} scroll-mt-20 space-y-4`}
        aria-label="Compare with"
      >
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
    </>
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
      className={`flex flex-col gap-1 rounded-lg px-4 py-3.5 ${
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
    <div className="overflow-x-auto">
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
      <h2 className="font-semibold">Check a lease quote</h2>
      <p className="mt-1 text-sm text-muted">
        Providers rarely show the interest rate. Put in the finance figures from your quote and
        we&apos;ll work it out.
      </p>
      {
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
      }
    </div>
  );
}

function Sources({ result, year }: { result: NovatedLeaseResult; year: string }) {
  return (
    <>
      <p className="text-sm text-muted">
        Uses the ATO&apos;s {year} tax rates, Medicare levy and HELP thresholds, the{" "}
        {result.carRules.year} <a href={result.carRules.sources[1]}>car limit</a> for the GST your
        employer claims back ({moneyExact(result.gstCredit)} here), the{" "}
        <a href={result.carRules.sources[0]}>luxury car tax thresholds</a>, and the FBT statutory
        formula (20% of the car&apos;s price) with the employee contribution method, which almost
        every provider uses. Later years use this year&apos;s tax rates. Not financial advice: check
        a real quote before you sign.
      </p>
    </>
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

function LeaveJob({ input, result }: { input: NovatedLeaseInput; result: NovatedLeaseResult }) {
  const [typed, setTyped] = useState<number | undefined>(undefined);
  const [per, setPer] = useState<LeasePer>("fortnightly");
  const monthsLeft = Math.min(result.months, Math.max(1, typed ?? Math.ceil(result.months / 2)));
  const s = useMemo(
    () => safe(() => leaveScenario(input, result, monthsLeft)),
    [input, result, monthsLeft],
  );
  const show = SHOW.find((o) => o.value === per) ?? SHOW[1];
  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-3">
        <p className="text-muted">
          A novated lease is a three-way deal between you, your employer and the lease provider.
          When you leave, it usually either moves to you personally or to a new employer who agrees
          to take it on. Not every employer will. If it becomes a personal lease, the payments come
          out of your after-tax pay.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Months left on the lease"
            suffix="months"
            min={1}
            max={result.months}
            step={1}
            value={monthsLeft}
            onChange={(v) => setTyped(v === undefined ? undefined : Math.round(v))}
          />
          <SelectField
            label="Show per"
            value={per}
            options={SHOW.map(({ value, label }) => ({ value, label }))}
            onChange={(v) => setPer(v)}
          />
        </div>
        {s && (
          <>
            <table className="num w-full text-sm">
              <thead>
                <tr className="text-right text-muted [&_th]:py-1.5 [&_th]:font-medium">
                  <th />
                  <th>Packaged now</th>
                  <th className="text-accent">Personal lease</th>
                </tr>
              </thead>
              <tbody className="[&_td]:border-t [&_td]:border-border [&_td]:py-2 [&_td:not(:first-child)]:text-right">
                <tr>
                  <td>Cost {show.per}</td>
                  <td>{moneyExact(s.current[per])}</td>
                  <td>{moneyExact(s.personal[per])}</td>
                </tr>
                <tr>
                  <td>Cost a year</td>
                  <td>{money(s.current.yearly)}</td>
                  <td>{money(s.personal.yearly)}</td>
                </tr>
                <tr className="font-semibold">
                  <td>Over {monthsLeft} months</td>
                  <td>{money(s.currentTotal)}</td>
                  <td>{money(s.personalTotal)}</td>
                </tr>
              </tbody>
            </table>
            <p>
              {s.extra >= 0 ? (
                <>
                  As a personal lease it would cost about <strong>{money(s.extra)} more</strong>{" "}
                  over the {monthsLeft} months left, because you lose the pre-tax saving and the GST
                  credit.
                </>
              ) : (
                <>
                  As a personal lease it would cost about <strong>{money(-s.extra)} less</strong>{" "}
                  over the {monthsLeft} months left.
                </>
              )}
            </p>
            <p className="text-muted">
              The residual is still due at the end, whoever holds the lease:{" "}
              <strong className="num text-text">{moneyExact(s.residualWithGst)}</strong> with GST,
              to keep the car or hand it back and settle the difference.
            </p>
          </>
        )}
        <p className="text-xs text-muted">
          Estimate only. We add GST back to the packaged amounts (except registration) because your
          employer no longer claims it. Early exit fees, a different rate from a personal lender and
          any new employer&apos;s terms can change this. Ask your provider what they&apos;d offer.
        </p>
      </div>
    </div>
  );
}
