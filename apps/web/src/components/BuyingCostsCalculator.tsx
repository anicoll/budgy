"use client";

import {
  AU_STATES,
  type AuState,
  type BuyerType,
  buyingCosts,
  dutyByState,
  HOME_GUARANTEE_CAP,
  HOME_GUARANTEE_SOURCE,
  type PropertyKind,
  STATE_NAMES,
} from "@budgy/engine";
import { useMemo } from "react";
import { MoneyField, SelectField } from "@/components/fields";
import { GoodToKnow } from "@/components/GoodToKnow";
import { ResultsBar } from "@/components/ResultsBar";
import { SavedBar } from "@/components/SavedBar";
import {
  type BuyingForm,
  decodeBuying,
  defaultBuying,
  encodeBuying,
  toBuyingInput,
} from "@/lib/buyingState";
import { money, moneyExact } from "@/lib/format";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox } from "./ui";

const card = "rounded-xl border border-border bg-surface";

const BUYING_SAVED: SavedConfig<BuyingForm> = {
  tool: "buying",
  initial: () => defaultBuying(),
  decode: (q) => decodeBuying(q),
  encode: encodeBuying,
};

const BUYERS: { value: BuyerType; label: string }[] = [
  { value: "firstHome", label: "First home" },
  { value: "ownerOccupier", label: "Living in it" },
  { value: "investor", label: "Investor" },
];

const PROPERTIES: { value: PropertyKind; label: string }[] = [
  { value: "existing", label: "Existing home" },
  { value: "new", label: "New home" },
  { value: "land", label: "Vacant land" },
];

function Segmented<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`min-h-11 rounded-lg border px-2 text-sm transition ${
                on
                  ? "border-accent bg-accent/10 font-medium text-accent"
                  : "border-border hover:border-accent"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Row({ label, hint, value }: { label: string; hint?: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border px-5 py-3 sm:px-6">
      <div>
        <div>{label}</div>
        {hint && <div className="text-sm text-muted">{hint}</div>}
      </div>
      <div className="num shrink-0 text-right">{value}</div>
    </div>
  );
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;

export function BuyingCostsCalculator() {
  const saved = useSavedState(BUYING_SAVED);
  const { state: form, setState: setForm } = saved;
  const set = (patch: Partial<BuyingForm>) => setForm((f) => ({ ...f, ...patch }));

  const input = useMemo(() => toBuyingInput(form), [form]);
  const r = useMemo(() => buyingCosts(input), [input]);
  const withHgs = useMemo(
    () =>
      r.homeGuaranteeEligible && !form.homeGuarantee
        ? buyingCosts({ ...input, homeGuarantee: true })
        : null,
    [r, input, form.homeGuarantee],
  );
  const states = useMemo(
    () =>
      dutyByState({
        price: input.price,
        buyer: input.buyer,
        property: input.property,
        foreign: input.foreign,
      }),
    [input],
  );

  const duty = r.duty;
  const stateName = STATE_NAMES[form.state];
  const depositPct = form.price > 0 ? Math.min(form.deposit, form.price) / form.price : 0;
  const lmiHint = !r.lmi.available
    ? "Lenders rarely lend above 95% of the price."
    : r.lmi.premium === 0
      ? form.homeGuarantee && r.homeGuaranteeEligible
        ? "None with the Home Guarantee Scheme."
        : "None needed with a 20% deposit."
      : `Estimate at ${pct(r.lvr)} LVR. Lenders quote the exact figure.${form.lmiOnLoan ? " Added to the loan." : ""}`;
  const maxDuty = Math.max(1, ...states.map((s) => s.total));

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Home buying costs</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Stamp duty, first home buyer concessions, mortgage insurance and fees in every state, so
          you know the cash you need on settlement day. Your numbers never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <section className={`${card} space-y-5 self-start p-5 sm:p-6`} aria-label="Your purchase">
          <SelectField
            label="State or territory"
            value={form.state}
            options={AU_STATES.map((s) => ({ value: s, label: STATE_NAMES[s] }))}
            onChange={(state: AuState) => set({ state })}
          />
          <MoneyField
            label="Purchase price"
            value={form.price}
            onChange={(v) => v !== undefined && set({ price: v })}
          />
          <MoneyField
            label="Deposit"
            hint={
              r.loan > 0
                ? `${pct(depositPct)} of the price. You'd borrow ${money(r.loan)} (${pct(r.lvr)} LVR).`
                : "That covers the whole price, so no loan."
            }
            value={form.deposit}
            onChange={(v) => v !== undefined && set({ deposit: v })}
          />
          <Segmented
            legend="Who's buying"
            value={form.buyer}
            options={BUYERS}
            onChange={(buyer) => set({ buyer })}
          />
          <Segmented
            legend="What you're buying"
            value={form.property}
            options={PROPERTIES}
            onChange={(property) => set({ property })}
          />
          <Checkbox
            className="flex items-start gap-2.5 text-sm"
            isSelected={form.foreign}
            onChange={(v) => set({ foreign: v })}
          >
            <span>
              A buyer isn&apos;t an Australian citizen or permanent resident
              <span className="mt-0.5 block text-xs text-muted">
                Adds the foreign purchaser surcharge and removes most concessions.
              </span>
            </span>
          </Checkbox>
          <details className="border-t border-border pt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Other costs (conveyancing, inspections, loan fees)
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MoneyField
                label="Conveyancing"
                value={form.conveyancing}
                onChange={(v) => set({ conveyancing: v ?? 0 })}
              />
              <MoneyField
                label="Building and pest"
                value={form.inspections}
                onChange={(v) => set({ inspections: v ?? 0 })}
              />
              <MoneyField
                label="Loan fees"
                value={form.loanFees}
                onChange={(v) => set({ loanFees: v ?? 0 })}
              />
              <MoneyField
                label="Anything else"
                hint="Moving, insurance, repairs."
                value={form.other}
                onChange={(v) => set({ other: v ?? 0 })}
              />
            </div>
          </details>
        </section>

        {form.view === "compare" ? (
          <section className="min-w-0 space-y-4" aria-label="Stamp duty in every state">
            <button
              type="button"
              className="text-sm text-accent hover:underline"
              onClick={() => set({ view: "costs" })}
            >
              ← Back to your costs
            </button>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Stamp duty on {money(input.price)} in every state
              </h2>
              <p className="mt-1 text-sm text-muted">
                {BUYERS.find((b) => b.value === form.buyer)?.label},{" "}
                {PROPERTIES.find((p) => p.value === form.property)?.label.toLowerCase()}, contracts
                signed from 1 July 2026. Pick a state to see its full breakdown.
              </p>
            </div>
            <ul className={`${card} px-5 py-2 sm:px-6`}>
              {states.map((s) => {
                const mine = s.state === form.state;
                return (
                  <li key={s.state} className="border-b border-border last:border-0">
                    <button
                      type="button"
                      onClick={() => set({ state: s.state, view: "costs" })}
                      className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 text-left sm:grid-cols-[200px_minmax(0,1fr)_110px]"
                    >
                      <span className={mine ? "font-semibold" : ""}>
                        {s.name}
                        <span className="block text-xs font-normal text-muted">
                          {s.concession ?? s.notes[0] ?? "General rate"}
                        </span>
                      </span>
                      <span className="col-span-2 row-start-2 h-3 overflow-hidden rounded bg-border/60 sm:col-span-1 sm:row-start-auto">
                        <span
                          className="block h-3 rounded"
                          style={{
                            width: `${Math.max(0.5, (s.total / maxDuty) * 100)}%`,
                            background: mine ? "var(--series-a)" : "var(--series-base)",
                          }}
                        />
                      </span>
                      <span
                        className={`num col-start-2 row-start-1 text-right sm:col-start-auto sm:row-start-auto ${mine ? "font-semibold" : ""}`}
                      >
                        {money(s.total)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted">
              Duty only. Mortgage insurance, fees and grants differ by state too and show in each
              state&apos;s breakdown.
            </p>
          </section>
        ) : (
          <section id="results" className="min-w-0 scroll-mt-4 space-y-5" aria-label="Your costs">
            <div className={`${card} p-6 sm:p-7`} aria-live="polite">
              <div className="text-sm text-muted">Cash you need by settlement</div>
              <div className="num mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
                {money(r.cashNeeded)}
              </div>
              <div className="mt-1 text-muted">
                Your {money(Math.min(input.deposit, input.price))} deposit plus{" "}
                <strong className="text-text">{money(r.costs)}</strong> in buying costs.
              </div>
            </div>

            {duty.saving > 0 && (
              <div className="flex gap-3 rounded-xl border border-good/30 bg-good/10 px-5 py-4">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-good"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <div>
                  <strong className="text-good">
                    {duty.concession ?? "A concession"} saves you {money(duty.saving)}
                  </strong>
                  <div className="text-sm">
                    Duty at the general rate would be {money(duty.generalDuty)}.
                  </div>
                </div>
              </div>
            )}

            <div className={`${card} overflow-hidden`}>
              <h2 className="border-b border-border px-5 py-4 font-semibold sm:px-6">
                Where the money goes
              </h2>
              <Row label="Deposit" value={money(Math.min(input.deposit, input.price))} />
              <Row
                label="Stamp duty"
                hint={
                  duty.foreignSurcharge > 0
                    ? `Includes a ${money(duty.foreignSurcharge)} foreign purchaser surcharge`
                    : duty.concession
                      ? `After the concession: ${duty.concession}`
                      : undefined
                }
                value={money(duty.total)}
              />
              <Row
                label="Lenders mortgage insurance"
                hint={lmiHint}
                value={
                  r.lmiUpfront > 0
                    ? `~${money(r.lmiUpfront)}`
                    : form.lmiOnLoan && r.lmi.premium > 0
                      ? `~${money(r.lmi.premium)} on loan`
                      : money(0)
                }
              />
              <Row
                label="Government registration fees"
                hint={`Transfer${r.fees.mortgage > 0 ? " and mortgage" : ""} registration${r.fees.estimate ? ", estimated" : ""}`}
                value={money(r.fees.transfer + r.fees.mortgage)}
              />
              <Row label="Conveyancing" value={money(r.other.conveyancing)} />
              {r.other.inspections > 0 && (
                <Row label="Building and pest inspection" value={money(r.other.inspections)} />
              )}
              {r.other.loanFees > 0 && <Row label="Loan fees" value={money(r.other.loanFees)} />}
              {r.other.other > 0 && <Row label="Other costs" value={money(r.other.other)} />}
              <div className="flex justify-between bg-bg/50 px-5 py-4 font-semibold sm:px-6">
                <span>Total</span>
                <span className="num">{money(r.cashNeeded)}</span>
              </div>
            </div>

            {(withHgs || r.homeGuaranteeEligible || r.lmi.premium > 0) && (
              <div className={`${card} space-y-2 p-5 sm:p-6`}>
                {withHgs && (
                  <>
                    <strong>You might not need mortgage insurance</strong>
                    <p className="text-sm text-muted">
                      First home buyers can borrow with a 5% deposit and no LMI under the{" "}
                      <a
                        href={HOME_GUARANTEE_SOURCE}
                        className="text-accent hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Home Guarantee Scheme
                      </a>
                      , up to {money(HOME_GUARANTEE_CAP[form.state] * 100)} in {stateName}&apos;s
                      capital (lower in regional areas). That would cut your upfront cash to{" "}
                      <strong className="text-text">{money(withHgs.cashNeeded)}</strong>.
                    </p>
                  </>
                )}
                {r.homeGuaranteeEligible && (
                  <Checkbox
                    className="flex min-h-11 items-center gap-2.5 text-sm"
                    isSelected={form.homeGuarantee}
                    onChange={(v) => set({ homeGuarantee: v })}
                  >
                    Show costs with the Home Guarantee Scheme
                  </Checkbox>
                )}
                {r.lmi.premium > 0 && (
                  <Checkbox
                    className="flex min-h-11 items-center gap-2.5 text-sm"
                    isSelected={form.lmiOnLoan}
                    onChange={(v) => set({ lmiOnLoan: v })}
                  >
                    Add LMI to the loan instead of paying it upfront
                  </Checkbox>
                )}
              </div>
            )}

            <details className={`${card} p-5 sm:p-6`} open>
              <summary className="cursor-pointer font-semibold">How this is calculated</summary>
              <div className="mt-4 space-y-2.5 text-sm">
                {duty.steps.map((s, i) => {
                  const last = i === duty.steps.length - 1 && duty.steps.length > 1;
                  return (
                    <div
                      key={s.label}
                      className={`flex justify-between gap-4 ${last ? "border-t border-border pt-2.5 font-semibold" : "text-muted"}`}
                    >
                      <span>{s.label}</span>
                      <span className="num shrink-0 text-text">{moneyExact(s.amount)}</span>
                    </div>
                  );
                })}
                {duty.notes.map((n) => (
                  <p key={n} className="text-muted">
                    {n}
                  </p>
                ))}
                <p className="pt-1 text-xs text-muted">
                  {stateName} rates for contracts signed in {duty.rulesYear}. Sources:{" "}
                  {duty.sources
                    .filter(
                      (u, i, all) =>
                        all.findIndex((x) => new URL(x).hostname === new URL(u).hostname) === i,
                    )
                    .map((u, i) => (
                      <span key={u}>
                        {i > 0 && ", "}
                        <a
                          href={u}
                          className="text-accent hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {new URL(u).hostname.replace(/^www\./, "")}
                        </a>
                      </span>
                    ))}
                  . Off-the-plan, pensioner and other special concessions aren&apos;t included.
                  Check with your conveyancer before you sign.
                </p>
              </div>
            </details>

            <button
              type="button"
              className="py-3 font-medium text-accent hover:underline"
              onClick={() => set({ view: "compare" })}
            >
              Compare stamp duty in every state →
            </button>
            <GoodToKnow tool="buying" />
          </section>
        )}
      </div>

      {form.view !== "compare" && (
        <ResultsBar>
          <strong>{money(r.cashNeeded)}</strong> needed by settlement
        </ResultsBar>
      )}
    </main>
  );
}
