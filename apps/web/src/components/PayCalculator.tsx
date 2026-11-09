"use client";

import {
  type Cents,
  calculatePay,
  keepFromRaise,
  type PayAmounts,
  type PayResult,
  type PayWarning,
  validatePay,
} from "@budgy/engine";
import { useEffect, useMemo, useState } from "react";
import { MoneyField, NumberField, SelectField } from "@/components/fields";
import { SavedBar } from "@/components/SavedBar";
import { budgetLinkFromPay } from "@/lib/budgetState";
import { money, moneyExact } from "@/lib/format";
import { PAY_PEOPLE } from "@/lib/household";
import { leaseInPay, saysHasLease, toggleLease, withSavedLease } from "@/lib/novatedPay";
import {
  annualise,
  decodePayState,
  defaultPayState,
  type EntryPer,
  encodePayState,
  fromAnnual,
  hasAdvanced,
  type LeaseInPay,
  PAY_YEARS,
  type PayState,
  type ShowPer,
  toPayInput,
} from "@/lib/payState";
import { readSaved } from "@/lib/saved";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox, Select } from "./ui";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const PAY_SAVED: SavedConfig<PayState> = {
  tool: "pay",
  initial: () => defaultPayState(),
  decode: (q) => decodePayState(q),
  encode: encodePayState,
  people: PAY_PEOPLE,
  // Your own pay picks up the novated lease you've saved; a shared link keeps its own.
  adopt: (s, { data, mode }) => (mode === "saved" ? withSavedLease(s, data) : s),
};

const ENTRY: { value: EntryPer; label: string }[] = [
  { value: "year", label: "Year" },
  { value: "month", label: "Month" },
  { value: "fortnight", label: "Fortnight" },
  { value: "week", label: "Week" },
  { value: "hour", label: "Hour" },
];
const SHOW: { value: ShowPer; label: string; per: string; n: number }[] = [
  { value: "weekly", label: "Week", per: "a week", n: 52 },
  { value: "fortnightly", label: "Fortnight", per: "a fortnight", n: 26 },
  { value: "monthly", label: "Month", per: "a month", n: 12 },
  { value: "annual", label: "Year", per: "a year", n: 1 },
];
const perLabel = (s: ShowPer) => SHOW.find((x) => x.value === s)?.per ?? "";
const entryPer: Record<EntryPer, string> = {
  year: "a year",
  month: "a month",
  fortnight: "a fortnight",
  week: "a week",
  hour: "an hour",
};

const COLORS = {
  net: "var(--good)",
  tax: "var(--series-a)",
  medicare: "var(--series-b)",
  loan: "var(--series-base)",
  packaging: "var(--series-c)",
};

const pct = (v: number, digits = 1) =>
  `${(v * 100).toLocaleString("en-AU", { maximumFractionDigits: digits })}%`;

function safePay(state: PayState, amount?: number): PayResult | null {
  const input = toPayInput(state, amount);
  if (validatePay(input).length) return null;
  try {
    return calculatePay(input);
  } catch {
    return null;
  }
}

export function PayCalculator() {
  const saved = useSavedState(PAY_SAVED);
  const { state, setState } = saved;
  const [moreOpen, setMoreOpen] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<PayState>) => setState((s) => ({ ...s, ...patch }));

  const result = useMemo(() => safePay(state), [state]);
  const compare = useMemo(
    () => (state.view === "compare" ? safePay(state, state.compareAmount) : null),
    [state],
  );
  const more = moreOpen ?? hasAdvanced(state);

  // The lease saved on this device, and whether the home page said there is one.
  const [savedLease, setSavedLease] = useState<{ lease: LeaseInPay | null; says: boolean }>({
    lease: null,
    says: false,
  });
  useEffect(() => {
    const data = readSaved();
    setSavedLease({ lease: leaseInPay(data.tools.lease), says: saysHasLease(data) });
  }, []);
  const setLease = (on: boolean) => setState((s) => toggleLease(s, on, readSaved()));

  const switchPer = (per: EntryPer) =>
    setState((s) => {
      const annual = annualise(s.amount, s.per, s.hoursPerWeek);
      const other = annualise(s.compareAmount, s.per, s.hoursPerWeek);
      return {
        ...s,
        per,
        amount: fromAnnual(annual, per, s.hoursPerWeek),
        compareAmount: fromAnnual(other, per, s.hoursPerWeek),
      };
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

  const show = state.show;
  const period = result ? result.periods[show] : null;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Pay calculator</h1>
        <p className="mt-1 max-w-2xl text-muted">
          What you take home each week, fortnight or month after tax, Medicare and HELP, using the
          ATO&apos;s {state.year} rates. Your numbers never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      {result && period && (
        <div
          className="sticky top-[var(--header-h)] z-10 -mx-4 mb-4 flex items-center justify-between gap-3 bg-primary-container px-4 py-3 text-on-primary-container lg:hidden"
          aria-live="polite"
        >
          <div>
            <p className="text-xs opacity-75">You take home</p>
            <p className="num text-2xl font-semibold">{moneyExact(period.net)}</p>
            <p className="text-xs opacity-75">
              {perLabel(show)}, plus {moneyExact(period.employerSuper)} super
            </p>
          </div>
          <div className="flex flex-col gap-1 text-xs opacity-90">
            <span aria-hidden>Show per</span>
            <Select<ShowPer>
              ariaLabel="Show per"
              triggerClassName="rounded-lg border border-on-primary-container/20 bg-surface/60 px-2 py-2 text-base text-on-primary-container"
              value={show}
              onChange={(show) => set({ show })}
              options={SHOW}
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* ── Inputs ─────────────────────────────────────────────── */}
        <section className={`${card} space-y-5 self-start`} aria-label="Your pay">
          <h2 className="font-semibold">Your pay</h2>

          <div className="space-y-2">
            <MoneyField
              label="Salary"
              value={state.amount}
              onChange={(v) => v !== undefined && set({ amount: v })}
            />
            <Segmented
              label="Salary is per"
              options={ENTRY}
              value={state.per}
              onChange={switchPer}
            />
            {state.per === "hour" && (
              <NumberField
                label="Hours a week"
                min={1}
                max={100}
                step={0.5}
                value={state.hoursPerWeek}
                onChange={(v) => v !== undefined && set({ hoursPerWeek: v })}
              />
            )}
          </div>

          <Check
            label="This amount includes super"
            checked={state.includesSuper}
            onChange={(v) => set({ includesSuper: v })}
          />
          <Check
            label="I have a HELP or other study loan"
            checked={state.studyLoan}
            onChange={(v) => set({ studyLoan: v })}
          />

          <LeaseOption
            state={state}
            saved={savedLease.lease}
            says={savedLease.says}
            onToggle={setLease}
          />

          <SelectField
            label="Financial year"
            value={state.year}
            onChange={(year) => set({ year })}
            options={PAY_YEARS.map((y) => ({
              value: y,
              label:
                y === defaultPayState().year
                  ? `${y} (this year)`
                  : y === "2027-28"
                    ? `${y} (14% rate cut)`
                    : y,
            }))}
          />

          <button
            type="button"
            className="text-left text-sm font-medium text-accent hover:underline"
            aria-expanded={more}
            onClick={() => setMoreOpen(!more)}
          >
            {more ? "Fewer options" : "More options: super, overtime, packaging, tax situation"}
          </button>

          {more && <MoreOptions state={state} set={set} />}
        </section>

        {/* ── Results ────────────────────────────────────────────── */}
        <section className="min-w-0 space-y-4" aria-label="Results">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              label="View"
              options={[
                { value: "pay", label: "Your pay" },
                { value: "compare", label: "Compare two salaries" },
              ]}
              value={state.view}
              onChange={(view) => set({ view })}
              pill
            />
            <PeriodTabs value={show} onChange={(s) => set({ show: s })} />
          </div>

          {!result || !period ? (
            <div className={card}>
              <p className="text-warn">
                {validatePay(toPayInput(state)).join(" ") || "Check your inputs."}
              </p>
            </div>
          ) : state.view === "compare" ? (
            <CompareView state={state} set={set} now={result} other={compare} />
          ) : (
            <PayView state={state} set={set} result={result} />
          )}

          {result && (
            <a
              href={budgetLinkFromPay(state)}
              className={`${card} block font-medium text-accent transition hover:border-accent`}
            >
              Plan a budget with this pay →
              <span className="mt-1 block text-sm font-normal text-muted">
                Start the budget planner from {moneyExact(result.periods.monthly.net)} a month
                take-home.
              </span>
            </a>
          )}

          {result && <Footer result={result} copied={copied} onCopy={copyLink} />}
        </section>
      </div>
    </main>
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────

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
          className={`px-1 py-2 ${
            o.value === value ? "bg-accent font-semibold text-on-accent" : "bg-surface hover:bg-bg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

function PeriodTabs({ value, onChange }: { value: ShowPer; onChange: (v: ShowPer) => void }) {
  return (
    <div className="hidden lg:block">
      <Segmented
        label="Show amounts per"
        options={SHOW.map(({ value, label }) => ({ value, label }))}
        value={value}
        onChange={onChange}
        pill
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-t border-border pt-4">
      <legend className="pr-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

const yearMoney = (dollars: number) => money(Math.round(dollars * 100));

/** Your novated lease, from the lease calculator, taken out of this pay. */
function LeaseOption({
  state,
  saved,
  says,
  onToggle,
}: {
  state: PayState;
  saved: LeaseInPay | null;
  says: boolean;
  onToggle: (on: boolean) => void;
}) {
  const lease = state.lease ?? saved;
  if (!lease) {
    if (!says) return null;
    return (
      <p className="rounded-lg bg-bg p-3 text-sm">
        You said you have a novated lease. Put it in the{" "}
        <a className="font-medium text-accent hover:underline" href="../novated-lease/">
          novated lease calculator
        </a>{" "}
        and it comes out of your pay here and in your budget.
      </p>
    );
  }
  const parts = [`${yearMoney(lease.preTax)} before tax`];
  if (lease.postTax > 0) parts.push(`${yearMoney(lease.postTax)} after tax`);
  return (
    <div>
      <Check
        label="Take my novated lease out of this pay"
        hint={`${parts.join(" and ")} a year${
          lease.fringe > 0 ? `, plus ${yearMoney(lease.fringe)} of reportable fringe benefits` : ""
        }, from the first year of your lease.`}
        checked={Boolean(state.lease)}
        onChange={onToggle}
      />
      {saved && (
        <a
          className="mt-1 ml-9 inline-block text-sm font-medium text-accent hover:underline"
          href="../novated-lease/"
        >
          Change your lease
        </a>
      )}
    </div>
  );
}

function MoreOptions({ state, set }: { state: PayState; set: (patch: Partial<PayState>) => void }) {
  const resident = state.residency === "resident";
  return (
    <div className="space-y-5">
      <Section title="Super">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Employer super"
            suffix="%"
            min={0}
            max={100}
            step={0.5}
            optional
            placeholder="12"
            hint="Blank uses the 12% super guarantee"
            value={state.superPct}
            onChange={(v) => set({ superPct: v })}
          />
          <MoneyField
            label="Salary sacrifice"
            hint="Into super, before tax, a year"
            value={state.sacrifice}
            onChange={(v) => set({ sacrifice: v ?? 0 })}
          />
        </div>
      </Section>

      <Section title="Extra pay">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Overtime hours"
            hint="A week, on average"
            min={0}
            max={80}
            step={0.5}
            value={state.overtimeHours}
            onChange={(v) => set({ overtimeHours: v ?? 0 })}
          />
          <SelectField
            label="Overtime rate"
            value={String(state.overtimeRate)}
            onChange={(v) => set({ overtimeRate: Number(v) })}
            options={[
              { value: "1", label: "Normal rate" },
              { value: "1.25", label: "Time and a quarter" },
              { value: "1.5", label: "Time and a half" },
              { value: "2", label: "Double time" },
              { value: "2.5", label: "Double time and a half" },
            ]}
          />
          {state.overtimeHours > 0 && state.per !== "hour" && (
            <NumberField
              label="Ordinary hours"
              hint="A week, to price overtime"
              min={1}
              max={100}
              step={0.5}
              value={state.hoursPerWeek}
              onChange={(v) => v !== undefined && set({ hoursPerWeek: v })}
            />
          )}
          <MoneyField
            label="Bonuses and commission"
            hint="A year. Super is paid on these"
            value={state.bonus}
            onChange={(v) => set({ bonus: v ?? 0 })}
          />
          <MoneyField
            label="Taxable allowances"
            hint="A year, such as tools or travel"
            value={state.allowances}
            onChange={(v) => set({ allowances: v ?? 0 })}
          />
        </div>
      </Section>

      <Section title="Packaging and deductions">
        <div className="grid grid-cols-2 gap-3">
          <MoneyField
            label="Other packaging"
            hint={
              state.lease
                ? "Before tax, a year, on top of your novated lease"
                : "Before tax, a year, such as a novated lease"
            }
            value={state.packaging}
            onChange={(v) => set({ packaging: v ?? 0 })}
          />
          <MoneyField
            label="Fringe benefits"
            hint="Reportable amount on your income statement"
            value={state.fringe}
            onChange={(v) => set({ fringe: v ?? 0 })}
          />
          <MoneyField
            label="Tax deductions"
            hint="A year, such as work expenses. Comes back at tax time"
            value={state.deductions}
            onChange={(v) => set({ deductions: v ?? 0 })}
          />
        </div>
      </Section>

      <Section title="Your tax situation">
        <fieldset className="m-0 mb-4 min-w-0 space-y-2 border-0 p-0">
          <legend className="mb-2 text-sm font-medium">For tax I&apos;m</legend>
          {(
            [
              ["resident", "An Australian resident"],
              ["foreign", "A foreign resident"],
              ["whm", "A working holiday maker (visa 417 or 462)"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-3">
              <input
                type="radio"
                name="residency"
                className="size-4 accent-[var(--accent)]"
                checked={state.residency === value}
                onChange={() => set({ residency: value })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        {resident && (
          <>
            <Check
              label="I claim the tax-free threshold from this job"
              hint="Changes what's withheld from each pay, not the tax you owe"
              checked={state.taxFreeThreshold}
              onChange={(v) => set({ taxFreeThreshold: v })}
            />
            <SelectField
              label="Medicare levy"
              value={state.medicareExemption}
              onChange={(medicareExemption) => set({ medicareExemption })}
              options={[
                { value: "none", label: "I pay it" },
                { value: "half", label: "Half exemption" },
                { value: "full", label: "Full exemption" },
              ]}
            />
          </>
        )}
        <Check
          label="I have private hospital cover"
          hint="Without it, higher incomes pay the Medicare levy surcharge"
          checked={state.hospitalCover}
          onChange={(v) => set({ hospitalCover: v })}
        />
        <Check
          label="I have a partner or dependent children"
          hint="Changes the Medicare levy and surcharge thresholds"
          checked={state.family}
          onChange={(v) => set({ family: v })}
        />
        {state.family && (
          <div className="grid grid-cols-2 gap-3">
            <MoneyField
              label="Partner's income"
              hint="A year"
              value={state.partnerIncome}
              onChange={(v) => set({ partnerIncome: v ?? 0 })}
            />
            <NumberField
              label="Dependent children"
              min={0}
              max={20}
              step={1}
              value={state.children}
              onChange={(v) => set({ children: Math.round(v ?? 0) })}
            />
          </div>
        )}
      </Section>
    </div>
  );
}

// ── Results ─────────────────────────────────────────────────────────────────

interface Slice {
  key: keyof typeof COLORS;
  label: string;
  value: number;
}

function slices(a: PayAmounts): Slice[] {
  const all: Slice[] = [
    { key: "net", label: "Take-home", value: a.net },
    { key: "tax", label: "Income tax", value: a.incomeTax },
    { key: "medicare", label: "Medicare", value: a.medicare + a.surcharge },
    { key: "loan", label: "HELP", value: a.studyLoan },
    {
      key: "packaging",
      label: a.afterTax > 0 ? "Packaging and lease" : "Packaging",
      value: a.salarySacrifice + a.otherPackaging + a.afterTax,
    },
  ];
  return all.filter((s) => s.value > 0);
}

function Breakdown({ a }: { a: PayAmounts }) {
  const total = Math.max(1, a.gross);
  const parts = slices(a);
  return (
    <>
      <div aria-hidden="true" className="mt-6 flex h-3.5 gap-0.5 overflow-hidden rounded-full">
        {parts.map((p) => (
          <div
            key={p.key}
            style={{ width: `${(p.value / total) * 100}%`, background: COLORS[p.key] }}
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: COLORS[p.key] }} />
            {p.label} {pct(p.value / total)}
          </li>
        ))}
      </ul>
    </>
  );
}

const COLS: ShowPer[] = ["weekly", "fortnightly", "monthly", "annual"];

const packagingLabel = (lease: boolean) =>
  lease ? "Packaging, with your lease" : "Other packaging";

function PayTable({ result, lease }: { result: PayResult; lease: boolean }) {
  const rows: { label: string; get: (a: PayAmounts) => number; sign?: -1; show: boolean }[] = [
    { label: "Gross pay", get: (a) => a.gross, show: true },
    {
      label: "Salary sacrifice to super",
      get: (a) => a.salarySacrifice,
      sign: -1,
      show: result.salarySacrifice > 0,
    },
    {
      label: packagingLabel(lease),
      get: (a) => a.otherPackaging,
      sign: -1,
      show: result.otherPackaging > 0,
    },
    { label: "Income tax", get: (a) => a.incomeTax, sign: -1, show: true },
    { label: "Medicare levy", get: (a) => a.medicare, sign: -1, show: result.medicare > 0 },
    {
      label: "Medicare levy surcharge",
      get: (a) => a.surcharge,
      sign: -1,
      show: result.surcharge > 0,
    },
    { label: "HELP repayment", get: (a) => a.studyLoan, sign: -1, show: result.studyLoan > 0 },
    {
      label: "Novated lease after tax",
      get: (a) => a.afterTax,
      sign: -1,
      show: result.afterTax > 0,
    },
  ];
  const cell = "border-b border-grid py-2.5";
  const fmt = (v: number, sign?: -1) => (sign && v > 0 ? `−${moneyExact(v)}` : moneyExact(v));
  return (
    <div className="mt-6 hidden sm:block">
      <table className="num w-full min-w-[520px] border-collapse text-right text-[15px]">
        <thead>
          <tr className="text-sm text-muted">
            <th className="border-b border-border py-2 text-left font-medium">
              <span className="sr-only">Item</span>
            </th>
            {COLS.map((c) => (
              <th key={c} className="border-b border-border py-2 font-medium">
                {SHOW.find((s) => s.value === c)?.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) => r.show)
            .map((r) => (
              <tr key={r.label}>
                <th scope="row" className={`${cell} text-left font-normal`}>
                  {r.label}
                </th>
                {COLS.map((c) => (
                  <td key={c} className={cell}>
                    {fmt(r.get(result.periods[c]), r.sign)}
                  </td>
                ))}
              </tr>
            ))}
          <tr className="font-semibold">
            <th scope="row" className="py-3 text-left">
              Take-home pay
            </th>
            {COLS.map((c) => (
              <td key={c}>{moneyExact(result.periods[c].net)}</td>
            ))}
          </tr>
          <tr className="text-muted">
            <th scope="row" className="border-t border-border py-2.5 text-left font-normal">
              Employer super ({pct(result.employerSuper > 0 ? superRateShown(result) : 0)})
            </th>
            {COLS.map((c) => (
              <td key={c} className="border-t border-border">
                {moneyExact(result.periods[c].employerSuper)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** One period as a list, for phones, where four columns don't fit. */
function PeriodList({ a, lease }: { a: PayAmounts; lease: boolean }) {
  const row = "flex justify-between border-b border-grid py-2.5";
  const out = (label: string, v: number) =>
    v > 0 ? (
      <div className={row}>
        <dt>{label}</dt>
        <dd>−{moneyExact(v)}</dd>
      </div>
    ) : null;
  return (
    <dl className="num mt-5 text-[15px] sm:hidden">
      <div className={row}>
        <dt>Gross pay</dt>
        <dd>{moneyExact(a.gross)}</dd>
      </div>
      {out("Salary sacrifice", a.salarySacrifice)}
      {out(packagingLabel(lease), a.otherPackaging)}
      {out("Income tax", a.incomeTax)}
      {out("Medicare levy", a.medicare)}
      {out("Medicare levy surcharge", a.surcharge)}
      {out("HELP repayment", a.studyLoan)}
      {out("Novated lease after tax", a.afterTax)}
      <div className="flex justify-between py-3 font-semibold">
        <dt>Take-home pay</dt>
        <dd>{moneyExact(a.net)}</dd>
      </div>
      <div className="flex justify-between border-t border-border py-2.5 text-muted">
        <dt>Employer super</dt>
        <dd>{moneyExact(a.employerSuper)}</dd>
      </div>
    </dl>
  );
}

/** The employer rate on ordinary pay, for the label (sacrifice is listed separately in the total). */
function superRateShown(r: PayResult): number {
  const ote = r.salary + r.bonus;
  return ote > 0
    ? (r.employerSuper - r.salarySacrifice) / Math.min(ote, r.superRules.maxContributionBase)
    : 0;
}

function PayView({
  state,
  set,
  result,
}: {
  state: PayState;
  set: (patch: Partial<PayState>) => void;
  result: PayResult;
}) {
  const p = result.periods[state.show];
  const rate = result.marginalRate;
  const raise = Math.round(state.raise * 100) as Cents;
  const kept = useMemo(() => {
    try {
      return keepFromRaise(toPayInput(state), raise);
    } catch {
      return null;
    }
  }, [state, raise]);
  const slipFreq = state.show === "annual" ? "fortnightly" : state.show;
  const slip = result.withholding?.[slipFreq];

  return (
    <>
      <div className={`${card} sm:p-6`}>
        <p className="text-muted">You take home</p>
        <p className="num mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
          {moneyExact(p.net)}{" "}
          <span className="text-lg font-medium text-muted sm:text-xl">{perLabel(state.show)}</span>
        </p>
        <p className="mt-1.5 text-sm text-muted">
          Plus {moneyExact(p.employerSuper)} in super from your employer
          {result.salarySacrifice > 0 ? ", including your salary sacrifice" : ""}
        </p>
        <Breakdown a={result} />
        <PayTable result={result} lease={Boolean(state.lease)} />
        <PeriodList a={p} lease={Boolean(state.lease)} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className={card}>
          <p className="text-sm text-muted">Marginal rate</p>
          <p className="num mt-1 text-2xl font-semibold">{pct(rate, 1)}</p>
          <p className="mt-1.5 text-sm text-muted">{marginalExplain(result, state.residency)}</p>
        </div>
        <div className={card}>
          <p className="text-sm text-muted">Average rate</p>
          <p className="num mt-1 text-2xl font-semibold">{pct(result.averageRate)}</p>
          <p className="mt-1.5 text-sm text-muted">
            Of your gross pay, in tax, levies{result.studyLoan > 0 ? " and HELP" : ""}
          </p>
        </div>
        <div className={`${card} col-span-2 sm:col-span-1`}>
          <MoneyField
            label="If you got a raise of"
            hint="A year, before tax"
            value={state.raise}
            onChange={(v) => v !== undefined && set({ raise: v })}
          />
          {kept !== null && (
            <p className="mt-2 text-sm">
              You&apos;d keep <strong className="num">{money(kept)}</strong> a year,{" "}
              {moneyExact(kept / 26)} a fortnight.
            </p>
          )}
        </div>
      </div>

      <div className={card}>
        <h2 className="font-semibold">Your pay slip</h2>
        {slip ? (
          <>
            <p className="mt-2">
              Each {slipFreq === "weekly" ? "week" : slipFreq === "monthly" ? "month" : "fortnight"}{" "}
              your employer withholds <strong className="num">{moneyExact(slip.tax)}</strong> in tax
              {slip.studyLoan > 0 && (
                <>
                  {" "}
                  and <strong className="num">{moneyExact(slip.studyLoan)}</strong> for HELP
                </>
              )}
              {slip.afterTax > 0 && (
                <>
                  , your lease takes <strong className="num">{moneyExact(slip.afterTax)}</strong>{" "}
                  after tax
                </>
              )}
              , so <strong className="num">{moneyExact(slip.net)}</strong> lands in your account.
            </p>
            <p className="mt-2 text-sm text-muted">
              {slip.atTaxTime >= 100
                ? `Over the year that's about ${money(slip.atTaxTime)} more than you owe, which comes back as a refund at tax time${result.deductions > 0 ? ", mostly from your deductions" : ""}.`
                : slip.atTaxTime <= -100
                  ? `Over the year that's about ${money(-slip.atTaxTime)} less than you owe, so expect a tax bill${result.surcharge > 0 ? " (the Medicare levy surcharge isn't withheld)" : ""}.`
                  : "Over the year that's within a dollar of what you owe."}{" "}
              Worked out with the ATO&apos;s withholding formulas for {result.year}, with your pay
              spread evenly.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Pay slip estimates use the ATO&apos;s withholding tables, which are in here for 2026-27
            so far. The take-home above is what you&apos;d end up with after tax time.
          </p>
        )}
      </div>

      <Warnings warnings={result.warnings} />
    </>
  );
}

function marginalExplain(r: PayResult, residency: PayState["residency"]): string {
  const parts: string[] = [];
  const brackets = r.rules[residency];
  const bracket = [...brackets].reverse().find((b) => r.taxableIncome >= b.from)?.rate ?? 0;
  if (r.marginalRate === 0) return "Your next dollar isn't taxed";
  parts.push(`${pct(bracket, 0)} tax`);
  if (r.medicare > 0) parts.push("2% Medicare");
  if (r.studyLoan > 0) {
    const h = r.rules.help;
    const loan =
      r.repaymentIncome >= h.topFrom
        ? h.topRate
        : r.repaymentIncome > h.band1To
          ? h.band2Rate
          : h.band1Rate;
    parts.push(`${pct(loan, 0)} HELP`);
  }
  return `Of your next dollar of salary: ${parts.join(", ")}${
    r.lito > 0 ? ", plus the offset tapering" : ""
  }`;
}

const WARNING_TEXT = (w: PayWarning): string => {
  switch (w.kind) {
    case "concessional-cap":
      return `Your concessional super contributions (${money(w.total)} with salary sacrifice) are over the ${money(w.cap)} cap. Unless you have unused cap from earlier years, the extra is taxed at your marginal rate.`;
    case "division-293":
      return `Your income plus super is over $250,000, so expect about ${money(w.extra)} of Division 293 tax on your super contributions, billed separately.`;
    case "packaging-too-big":
      return "Your salary sacrifice and packaging add up to more than your pay, so they've been capped at your pay.";
    case "deductions-too-big":
      return "Your deductions are more than your income, so they've been capped.";
  }
};

function Warnings({ warnings }: { warnings: PayWarning[] }) {
  if (!warnings.length) return null;
  return (
    <ul className="space-y-2">
      {warnings.map((w) => (
        <li key={w.kind} className="rounded-lg border border-warn/40 bg-warn/5 px-4 py-3 text-sm">
          {WARNING_TEXT(w)}
        </li>
      ))}
    </ul>
  );
}

function CompareView({
  state,
  set,
  now,
  other,
}: {
  state: PayState;
  set: (patch: Partial<PayState>) => void;
  now: PayResult;
  other: PayResult | null;
}) {
  const per = state.show;
  const diff = other ? other.periods[per].net - now.periods[per].net : 0;
  const grossDiff = other ? other.gross - now.gross : 0;
  const keptDiff = other ? other.net - now.net : 0;
  const superDiff = other ? other.employerSuper - now.employerSuper : 0;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_260px]">
      <CompareCard
        title="Now"
        amount={state.amount}
        per={state.per}
        onAmount={(v) => set({ amount: v })}
        result={now}
        show={per}
      />
      <CompareCard
        title="New offer"
        amount={state.compareAmount}
        per={state.per}
        onAmount={(v) => set({ compareAmount: v })}
        result={other}
        show={per}
        highlight
      />
      <aside className="rounded-xl bg-primary-container p-5 text-on-primary-container md:col-span-2 xl:col-span-1">
        <p className="text-sm opacity-75">The difference</p>
        <p
          className={`num mt-1 text-4xl font-semibold ${diff >= 0 ? "text-[var(--good)]" : "text-[var(--warn)]"}`}
          style={{ filter: "brightness(1.35)" }}
        >
          {diff >= 0 ? "+" : "−"}
          {moneyExact(Math.abs(diff))}
        </p>
        <p className="text-sm opacity-75">
          {diff >= 0 ? "more" : "less"} in your pocket {perLabel(per)}
        </p>
        {other && grossDiff !== 0 && (
          <div className="mt-4 space-y-2 border-t border-on-primary-container/15 pt-4 text-sm">
            <p>
              Of the {grossDiff > 0 ? "extra" : "lost"} {money(Math.abs(grossDiff))} a year you{" "}
              {grossDiff > 0 ? "keep" : "lose"} <strong>{money(Math.abs(keptDiff))}</strong>.
            </p>
            {superDiff !== 0 && (
              <p>
                Your employer adds <strong>{money(Math.abs(superDiff))}</strong>{" "}
                {superDiff > 0 ? "more" : "less"} to super a year.
              </p>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

function CompareCard({
  title,
  amount,
  per,
  onAmount,
  result,
  show,
  highlight,
}: {
  title: string;
  amount: number;
  per: EntryPer;
  onAmount: (v: number) => void;
  result: PayResult | null;
  show: ShowPer;
  highlight?: boolean;
}) {
  const p = result?.periods[show];
  const row = "flex justify-between border-b border-grid py-1.5 last:border-0";
  return (
    <section
      className={`rounded-xl bg-surface p-5 ${highlight ? "border-2 border-accent" : "border border-border"}`}
    >
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2">
        <MoneyField
          label={`Salary ${entryPer[per]}`}
          value={amount}
          onChange={(v) => v !== undefined && onAmount(v)}
        />
      </div>
      {p ? (
        <>
          <p className="num mt-4 text-3xl font-semibold">{moneyExact(p.net)}</p>
          <p className="text-sm text-muted">take-home {perLabel(show)}</p>
          <dl className="num mt-3 text-sm text-muted">
            <div className={row}>
              <dt>Gross</dt>
              <dd>{moneyExact(p.gross)}</dd>
            </div>
            <div className={row}>
              <dt>Income tax</dt>
              <dd>−{moneyExact(p.incomeTax)}</dd>
            </div>
            <div className={row}>
              <dt>Medicare</dt>
              <dd>−{moneyExact(p.medicare + p.surcharge)}</dd>
            </div>
            {p.studyLoan > 0 && (
              <div className={row}>
                <dt>HELP</dt>
                <dd>−{moneyExact(p.studyLoan)}</dd>
              </div>
            )}
            {p.salarySacrifice + p.otherPackaging > 0 && (
              <div className={row}>
                <dt>Packaging</dt>
                <dd>−{moneyExact(p.salarySacrifice + p.otherPackaging)}</dd>
              </div>
            )}
            <div className={row}>
              <dt>Employer super</dt>
              <dd>{moneyExact(p.employerSuper)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="mt-4 text-sm text-warn">Enter a salary to compare.</p>
      )}
    </section>
  );
}

function Footer({
  result,
  copied,
  onCopy,
}: {
  result: PayResult;
  copied: boolean;
  onCopy: () => void;
}) {
  const notes = [...result.notes];
  if (result.carriedForward) notes.unshift(`Using ${result.year} rates, the latest published.`);
  return (
    <div className="space-y-2 text-sm text-muted">
      <p>
        Take-home is worked out as the ATO assesses it at tax time: income tax, the low income tax
        offset, Medicare levy and surcharge, and study loan repayments. It doesn&apos;t cover the
        seniors offset, other income or capital gains.
      </p>
      {notes.map((n) => (
        <p key={n}>{n}</p>
      ))}
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        <span>Sources:</span>
        {[...result.rules.sources, ...result.superRules.sources.slice(0, 1)].map((s) => (
          <a
            key={s}
            href={s}
            className="text-accent hover:underline"
            rel="noreferrer"
            target="_blank"
          >
            {sourceName(s)}
          </a>
        ))}
        <button type="button" onClick={onCopy} className="font-medium text-accent hover:underline">
          {copied ? "Link copied" : "Copy link"}
        </button>
      </p>
    </div>
  );
}

function sourceName(url: string): string {
  if (url.includes("working-holiday")) return "WHM rates";
  if (url.includes("study-and-training")) return "HELP thresholds";
  if (url.includes("surcharge")) return "Medicare levy surcharge";
  if (url.includes("medicare-levy")) return "Medicare levy";
  if (url.includes("super-guarantee")) return "Super guarantee";
  return "Income tax rates";
}
