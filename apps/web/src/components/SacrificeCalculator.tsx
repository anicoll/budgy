"use client";

import {
  type Cents,
  checkSacrifice,
  MAX_SACRIFICE_FUNDS,
  MAX_SACRIFICE_PEOPLE,
  maxExtra,
  type PersonSacrifice,
  type SacrificeEffect,
  type SacrificeResult,
  type SacrificeSuggestion,
  type SacrificeWarning,
  sacrificeEffect,
  sacrificeForTakeHome,
  validateSacrifice,
} from "@budgy/engine";
import { useMemo, useState } from "react";
import { MoneyField, NumberField, SelectField } from "@/components/fields";
import { SavedBar } from "@/components/SavedBar";
import { money, moneyExact } from "@/lib/format";
import { SACRIFICE_PEOPLE } from "@/lib/household";
import {
  activePeople,
  decodeSacrificeState,
  defaultSacrificeState,
  encodeSacrificeState,
  newPerson,
  nextId,
  type PersonRow,
  SACRIFICE_YEARS,
  type SacrificeState,
  SHOW_N,
  type ShowPer,
  toSacrificeInput,
  toSacrificePerson,
} from "@/lib/sacrificeState";
import { type SavedConfig, useSavedState } from "@/lib/useSavedState";
import { Checkbox, filledField, Slider } from "./ui";

const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";
const SAVED: SavedConfig<SacrificeState> = {
  tool: "sacrifice",
  initial: () => defaultSacrificeState(),
  decode: (q) => decodeSacrificeState(q),
  encode: encodeSacrificeState,
  people: SACRIFICE_PEOPLE,
};

const SHOW: { value: ShowPer; label: string; per: string }[] = [
  { value: "weekly", label: "Week", per: "a week" },
  { value: "fortnightly", label: "Fortnight", per: "a fortnight" },
  { value: "monthly", label: "Month", per: "a month" },
  { value: "annual", label: "Year", per: "a year" },
];
const perLabel = (s: ShowPer) => SHOW.find((x) => x.value === s)?.per ?? "";

const COLORS = {
  you: "var(--series-a)",
  taxSaved: "color-mix(in srgb, var(--series-a) 40%, var(--surface))",
  super: "var(--good)",
  tax: "var(--border)",
  employer: "var(--series-base)",
};

const cents = (c: number) => c / 100;
const cpd = (rate: number) =>
  `${(rate * 100).toLocaleString("en-AU", { maximumFractionDigits: 1 })}c`;

function safeCheck(state: SacrificeState): SacrificeResult | null {
  const input = toSacrificeInput(state);
  if (validateSacrifice(input).length) return null;
  try {
    return checkSacrifice(input);
  } catch {
    return null;
  }
}

export function SacrificeCalculator() {
  const saved = useSavedState(SAVED);
  const { state, setState } = saved;
  const [copied, setCopied] = useState(false);
  const set = (patch: Partial<SacrificeState>) => setState((s) => ({ ...s, ...patch }));
  const setPerson = (id: string, patch: Partial<PersonRow>) =>
    setState((s) => ({
      ...s,
      people: s.people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));

  const result = useMemo(() => safeCheck(state), [state]);
  const people = activePeople(state);
  const show = state.show;
  const n = SHOW_N[show];
  const fmt = (c: number) => (show === "annual" ? money(c) : moneyExact(Math.round(c / n)));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the address bar still has the link */
    }
  };

  const addPerson = () =>
    setState((s) => {
      if (s.people.length >= MAX_SACRIFICE_PEOPLE) return s;
      const id = nextId(
        "p",
        s.people.map((p) => p.id),
      );
      return {
        ...s,
        mode: "household",
        people: [...s.people, newPerson(id, `Person ${s.people.length + 1}`)],
      };
    });
  const removePerson = (id: string) =>
    setState((s) =>
      s.people.length <= 1 ? s : { ...s, people: s.people.filter((p) => p.id !== id) },
    );

  const total = result?.total;
  const me = result?.people[0];

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-24 sm:pt-10 lg:pb-10">
      <header className="mb-6">
        <a href=".." className="text-sm text-muted hover:text-text">
          ← All tools
        </a>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Salary sacrifice check
        </h1>
        <p className="mt-1 max-w-2xl text-muted">
          See what putting more of your pay into super really costs you, how much tax it saves, and
          how much room is left under your cap. Your numbers never leave your device.
        </p>
        <SavedBar saved={saved} />
      </header>

      {total && (
        <div
          className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 bg-primary-container px-4 py-3 text-on-primary-container lg:hidden"
          aria-live="polite"
        >
          <div>
            <p className="text-xs opacity-75">Costs you</p>
            <p className="num text-xl font-semibold">{fmt(total.takeHomeCost)}</p>
            <p className="text-xs opacity-75">{perLabel(show)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-75">Adds to super</p>
            <p className="num text-xl font-semibold">+{fmt(total.intoSuper)}</p>
            <p className="num text-xs opacity-75">
              {total.takeHomeCost > 0
                ? `$${(total.intoSuper / total.takeHomeCost).toFixed(2)} per $1`
                : " "}
            </p>
          </div>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Who"
          options={[
            { value: "me", label: "Just me" },
            { value: "household", label: "Household" },
          ]}
          value={state.mode}
          onChange={(mode) => set({ mode })}
        />
        <Segmented
          label="Show amounts per"
          options={SHOW.map(({ value, label }) => ({ value, label }))}
          value={show}
          onChange={(s) => set({ show: s })}
        />
      </div>

      {state.mode === "me" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
          <section className={`${card} self-start`} aria-label="Your pay">
            <PersonForm
              person={state.people[0]}
              year={state.year}
              show={show}
              onChange={(patch) => setPerson(state.people[0].id, patch)}
              yearField={
                <SelectField
                  label="Financial year"
                  value={state.year}
                  onChange={(year) => set({ year })}
                  options={SACRIFICE_YEARS.map((y) => ({ value: y, label: y }))}
                />
              }
            />
          </section>
          <section className="min-w-0 space-y-4" aria-label="Results">
            {!me || !result ? (
              <Invalid state={state} />
            ) : (
              <>
                <Statement effect={me.effect} show={show} fmt={fmt} />
                <WhereItGoes effect={me.effect} />
                <NumbersTable effect={me.effect} show={show} fmt={fmt} />
                <CapMeter person={me} year={result.year} you />
                <Ideas
                  people={[me]}
                  show={show}
                  fmt={fmt}
                  you
                  onUse={(id, extra) => setPerson(id, { extra: cents(extra) })}
                />
                <Warnings people={[me]} you />
              </>
            )}
            {result && <Footer result={result} copied={copied} onCopy={copyLink} />}
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))]">
            {people.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                year={state.year}
                show={show}
                canRemove={people.length > 1}
                onRemove={() => removePerson(p.id)}
                onChange={(patch) => setPerson(p.id, patch)}
              />
            ))}
            {people.length < MAX_SACRIFICE_PEOPLE && (
              <button
                type="button"
                onClick={addPerson}
                className="min-h-40 rounded-xl border-2 border-dashed border-border font-medium text-accent hover:border-accent"
              >
                + Add a person
                <span className="mt-1 block text-xs font-normal text-muted">
                  Up to {MAX_SACRIFICE_PEOPLE} people, {MAX_SACRIFICE_FUNDS} funds each
                </span>
              </button>
            )}
          </div>

          <div className={`${card} flex flex-wrap items-end gap-4`}>
            <MoneyField
              className="min-w-0 flex-[1_1_280px]"
              label={`How much take-home pay can the household give up ${perLabel(show)}?`}
              value={Math.round((state.budget / n) * 100) / 100}
              onChange={(v) => set({ budget: (v ?? 0) * n })}
            />
            <div className="min-w-0 flex-[2_1_320px] space-y-2">
              <p className="text-sm text-muted">
                We split it between you so each dollar puts the most into super, staying under
                everyone&apos;s cap.
              </p>
              <SelectField
                label="Financial year"
                value={state.year}
                onChange={(year) => set({ year })}
                options={SACRIFICE_YEARS.map((y) => ({ value: y, label: y }))}
              />
            </div>
          </div>

          {!result ? (
            <Invalid state={state} />
          ) : (
            <>
              <BudgetSplit
                result={result}
                people={people}
                fmt={fmt}
                onUse={(split) =>
                  setState((s) => ({
                    ...s,
                    people: s.people.map((p) => {
                      const share = split.find((x) => x.id === p.id);
                      return share ? { ...p, extra: cents(share.extra) } : p;
                    }),
                  }))
                }
              />
              <HouseholdTable result={result} people={people} fmt={fmt} show={show} />
              <Ideas
                people={result.people}
                show={show}
                fmt={fmt}
                onUse={(id, extra) => setPerson(id, { extra: cents(extra) })}
              />
              <Warnings people={result.people} />
            </>
          )}
          {result && <Footer result={result} copied={copied} onCopy={copyLink} />}
        </div>
      )}
    </main>
  );
}

// ── Inputs ──────────────────────────────────────────────────────────────────

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset
      aria-label={label}
      className="m-0 flex min-w-0 flex-wrap rounded-full border border-border bg-surface p-0.5 text-sm"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-full px-3.5 py-1.5 ${
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

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Checkbox
      className="flex min-h-7 cursor-pointer gap-3"
      isSelected={checked}
      onChange={(v) => onChange(v)}
    >
      <span>{label}</span>
    </Checkbox>
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

/** The most extra a person can add, a year, in cents. */
function capFor(p: PersonRow, year: string): Cents {
  try {
    return maxExtra(toSacrificePerson(p), year);
  } catch {
    return 0 as Cents;
  }
}

function ExtraField({
  person,
  year,
  show,
  onChange,
}: {
  person: PersonRow;
  year: string;
  show: ShowPer;
  onChange: (patch: Partial<PersonRow>) => void;
}) {
  const n = SHOW_N[show];
  const [budgetOpen, setBudgetOpen] = useState(false);
  const cap = cents(capFor(person, year)) / n;
  const perPeriod = Math.round((person.extra / n) * 100) / 100;
  return (
    <div className="space-y-2">
      <MoneyField
        label={`Amount ${perLabel(show)}`}
        value={perPeriod}
        onChange={(v) => onChange({ extra: (v ?? 0) * n })}
      />
      <Slider
        label="Extra to sacrifice"
        min={0}
        max={Math.max(1, Math.floor(cap))}
        step={1}
        value={Math.min(perPeriod, Math.floor(cap))}
        onChange={(v) => onChange({ extra: v * n })}
      />
      <p className="num flex justify-between text-xs text-muted">
        <span>$0</span>
        <span>
          Cap: {moneyExact(Math.round((cap * 100) / 1))} {perLabel(show)}
        </span>
      </p>
      {budgetOpen ? (
        <MoneyField
          label={`Take-home I can give up ${perLabel(show)}`}
          value={undefined}
          optional
          onChange={(v) => {
            if (v === undefined) return;
            const extra = sacrificeForTakeHome(
              toSacrificePerson({ ...person, extra: 0 }),
              year,
              Math.round(v * n * 100) as Cents,
            );
            onChange({ extra: cents(extra) });
            setBudgetOpen(false);
          }}
          hint="We'll work out the sacrifice that costs you that much."
        />
      ) : (
        <button
          type="button"
          className="text-left text-sm font-medium text-accent hover:underline"
          onClick={() => setBudgetOpen(true)}
        >
          Or work back from how much take-home you can give up
        </button>
      )}
    </div>
  );
}

function PersonForm({
  person,
  year,
  show,
  onChange,
  yearField,
  compact,
}: {
  person: PersonRow;
  year: string;
  show: ShowPer;
  onChange: (patch: Partial<PersonRow>) => void;
  yearField?: React.ReactNode;
  compact?: boolean;
}) {
  const [moreOpen, setMoreOpen] = useState<boolean | null>(null);
  const more =
    moreOpen ??
    Boolean(
      person.personal ||
        person.unusedCaps ||
        person.studyLoan ||
        !person.hospitalCover ||
        person.funds.length > 1,
    );
  const setFund = (id: string, patch: Partial<PersonRow["funds"][number]>) =>
    onChange({ funds: person.funds.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const addFund = () => {
    if (person.funds.length >= MAX_SACRIFICE_FUNDS) return;
    const id = nextId(
      `${person.id}f`,
      person.funds.map((f) => f.id),
    );
    onChange({ funds: [...person.funds, { id, name: "Super fund", balance: 0 }] });
  };
  const removeFund = (id: string) => {
    const funds = person.funds.filter((f) => f.id !== id);
    onChange({
      funds,
      extraFund: person.extraFund === id ? funds[0].id : person.extraFund,
    });
  };

  return (
    <div className="space-y-5">
      {!compact && <h2 className="font-semibold">Your pay</h2>}
      <MoneyField
        label="Salary before tax, a year"
        value={person.salary}
        onChange={(v) => v !== undefined && onChange({ salary: v })}
      />
      <div className="grid grid-cols-2 gap-3">
        {yearField}
        <NumberField
          label="Employer super"
          suffix="%"
          min={0}
          max={50}
          step={0.5}
          optional
          placeholder="12"
          value={person.employerPct}
          onChange={(v) => onChange({ employerPct: v })}
          className={yearField ? "" : "col-span-2"}
        />
      </div>
      <MoneyField
        label="Already salary sacrificing, a year"
        value={person.current}
        onChange={(v) => onChange({ current: v ?? 0 })}
      />

      <Section title="Extra to sacrifice">
        <ExtraField person={person} year={year} show={show} onChange={onChange} />
        {person.funds.length > 1 && (
          <SelectField
            label="Pay it into"
            value={person.extraFund}
            onChange={(extraFund) => onChange({ extraFund })}
            options={person.funds.map((f) => ({ value: f.id, label: f.name || "Super fund" }))}
          />
        )}
      </Section>

      <button
        type="button"
        className="text-left text-sm font-medium text-accent hover:underline"
        aria-expanded={more}
        onClick={() => setMoreOpen(!more)}
      >
        {more ? "Fewer options" : "More options: funds, unused cap, HELP, hospital cover"}
      </button>

      {more && (
        <div className="space-y-5">
          <Section title="Super funds">
            {person.funds.map((f, i) => (
              <div key={f.id} className="flex items-end gap-2">
                <label className="min-w-0 flex-[1.3]">
                  <span className="mb-1 block text-sm font-medium">Name</span>
                  <input
                    className={filledField}
                    value={f.name}
                    maxLength={40}
                    onChange={(e) => setFund(f.id, { name: e.target.value })}
                  />
                </label>
                <MoneyField
                  className="min-w-0 flex-1"
                  label="Balance"
                  value={f.balance}
                  onChange={(v) => setFund(f.id, { balance: v ?? 0 })}
                />
                {i > 0 && (
                  <button
                    type="button"
                    aria-label={`Remove ${f.name || "fund"}`}
                    className="min-h-11 min-w-11 text-xl text-muted hover:text-text"
                    onClick={() => removeFund(f.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {person.funds.length < MAX_SACRIFICE_FUNDS && (
              <button
                type="button"
                className="min-h-10 text-sm font-medium text-accent hover:underline"
                onClick={addFund}
              >
                + Add another fund
              </button>
            )}
          </Section>
          <Section title="Other contributions and tax">
            <MoneyField
              label="Personal deductible contributions, a year"
              value={person.personal}
              onChange={(v) => onChange({ personal: v ?? 0 })}
              hint="After-tax money you put in and claim as a deduction. It counts towards the cap."
            />
            <MoneyField
              label="Unused cap from earlier years"
              value={person.unusedCaps}
              onChange={(v) => onChange({ unusedCaps: v ?? 0 })}
              hint="Find it in myGov under Super › Information. You can use it if your total balance was under $500,000 on 30 June."
            />
            <Check
              label="I have a HELP or other study loan"
              checked={person.studyLoan}
              onChange={(studyLoan) => onChange({ studyLoan })}
            />
            <Check
              label="I have private hospital cover"
              checked={person.hospitalCover}
              onChange={(hospitalCover) => onChange({ hospitalCover })}
            />
          </Section>
        </div>
      )}
    </div>
  );
}

function PersonCard({
  person,
  year,
  show,
  canRemove,
  onRemove,
  onChange,
}: {
  person: PersonRow;
  year: string;
  show: ShowPer;
  canRemove: boolean;
  onRemove: () => void;
  onChange: (patch: Partial<PersonRow>) => void;
}) {
  return (
    <section className={`${card} space-y-4`} aria-label={person.name || "Person"}>
      <div className="flex items-center justify-between gap-2">
        <input
          aria-label="Name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-lg font-semibold outline-none hover:border-border focus:border-accent"
          value={person.name}
          maxLength={40}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {canRemove && (
          <button
            type="button"
            aria-label={`Remove ${person.name || "person"}`}
            className="min-h-11 min-w-11 text-xl text-muted hover:text-text"
            onClick={onRemove}
          >
            ×
          </button>
        )}
      </div>
      <PersonForm person={person} year={year} show={show} onChange={onChange} compact />
    </section>
  );
}

// ── Results ─────────────────────────────────────────────────────────────────

function Invalid({ state }: { state: SacrificeState }) {
  return (
    <div className={card}>
      <p className="text-warn">
        {validateSacrifice(toSacrificeInput(state)).join(" ") || "Check your inputs."}
      </p>
    </div>
  );
}

function Statement({
  effect,
  show,
  fmt,
}: {
  effect: SacrificeEffect;
  show: ShowPer;
  fmt: (c: number) => string;
}) {
  if (effect.extra <= 0) {
    return (
      <div className="rounded-xl bg-primary-container p-5 text-on-primary-container sm:p-6">
        <p className="text-lg">
          Enter an extra amount to sacrifice, or try one of the ideas below.
        </p>
      </div>
    );
  }
  return (
    <div
      className="space-y-3 rounded-xl bg-primary-container p-5 text-on-primary-container sm:p-6"
      aria-live="polite"
    >
      <p className="text-lg leading-relaxed sm:text-xl">
        Sacrificing <strong className="num">{fmt(effect.extra)}</strong> {perLabel(show)} costs you{" "}
        <strong className="num">{fmt(effect.takeHomeCost)}</strong> in take-home pay and puts{" "}
        <strong className="num">{fmt(effect.intoSuper)}</strong> more into your super.
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="num rounded-full bg-on-primary-container/10 px-3 py-1.5">
          ${effect.superPerDollar.toFixed(2)} into super for every $1 you give up
        </span>
        <span className="num rounded-full bg-on-primary-container/10 px-3 py-1.5">
          {effect.netGain >= 0
            ? `${money(effect.netGain)} a year better off overall`
            : `${money(-effect.netGain)} a year worse off overall`}
        </span>
      </div>
    </div>
  );
}

function Bar({
  label,
  parts,
}: {
  label: string;
  parts: { label: string; value: number; color: string; dark?: boolean }[];
}) {
  const sum = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  const shown = parts.filter((p) => p.value > 0);
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-sm text-muted">{label}</span>
      <div
        className="num flex h-9 min-w-0 flex-1 overflow-hidden rounded-md text-xs font-medium sm:text-sm"
        role="img"
        aria-label={`${label}: ${shown.map((p) => `${p.label} ${money(p.value)}`).join(", ")}`}
      >
        {shown.map((p) => (
          <div
            key={p.label}
            className={`flex items-center overflow-hidden px-2 whitespace-nowrap ${p.dark ? "text-bg" : "text-text"}`}
            style={{ width: `${(p.value / sum) * 100}%`, background: p.color }}
          >
            {p.value / sum > 0.12 ? `${p.label} ${money(p.value)}` : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function WhereItGoes({ effect }: { effect: SacrificeEffect }) {
  if (effect.extra <= 0) return null;
  // What's paid in comes from take-home and tax saved; what lands is super and taxes.
  const lost = effect.contributionsTax + effect.division293;
  return (
    <div className={card}>
      <h2 className="font-semibold">
        Where the {money(effect.extra)} a year comes from, and where it goes
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        The tax you no longer pay covers part of it. The fund takes 15% on the way in
        {effect.division293 > 0 ? ", plus Division 293 tax" : ""}.
      </p>
      <div className="space-y-2.5">
        <Bar
          label="Paid by"
          parts={[
            { label: "You", value: effect.takeHomeCost, color: COLORS.you, dark: true },
            { label: "Tax saved", value: effect.taxSaved, color: COLORS.taxSaved },
          ]}
        />
        <Bar
          label="Ends up as"
          parts={[
            { label: "Super", value: effect.intoSuper, color: COLORS.super, dark: true },
            { label: "Tax", value: lost - Math.min(0, effect.listoChange), color: COLORS.tax },
          ]}
        />
      </div>
      {effect.listoChange !== 0 && (
        <p className="num mt-3 text-sm text-muted">
          {effect.listoChange > 0
            ? `Includes ${money(effect.listoChange)} more low income super tax offset.`
            : `You'd lose ${money(-effect.listoChange)} of the low income super tax offset.`}
        </p>
      )}
    </div>
  );
}

function NumbersTable({
  effect,
  show,
  fmt,
}: {
  effect: SacrificeEffect;
  show: ShowPer;
  fmt: (c: number) => string;
}) {
  const { before: b, after: a } = effect;
  const rows: { label: string; now: number; after: number; good?: boolean; bold?: boolean }[] = [
    { label: "Take-home pay", now: b.pay.net, after: a.pay.net, bold: true },
    { label: "Income tax, Medicare and HELP", now: b.pay.totalTax, after: a.pay.totalTax },
    {
      label: "Into super, after tax",
      now: b.intoSuper,
      after: a.intoSuper,
      good: true,
      bold: true,
    },
    {
      label: "Contributions tax",
      now: b.contributionsTax + b.division293,
      after: a.contributionsTax + a.division293,
    },
  ];
  const signed = (c: number) => (c === 0 ? fmt(0) : c > 0 ? `+${fmt(c)}` : `−${fmt(-c)}`);
  const rate = (r: number) => `${(r * 100).toLocaleString("en-AU", { maximumFractionDigits: 1 })}%`;
  return (
    <div className={card}>
      <h2 className="font-semibold">The numbers, {perLabel(show)}</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="num w-full border-collapse text-sm sm:text-[15px]">
          <thead>
            <tr className="text-sm text-muted">
              <th className="py-2 text-left font-normal">
                <span className="sr-only">Item</span>
              </th>
              <th className="py-2 pl-3 text-right font-normal">Now</th>
              <th className="py-2 pl-3 text-right font-normal">With extra</th>
              <th className="py-2 pl-3 text-right font-normal">Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = r.after - r.now;
              const good = r.good ? d > 0 : r.label.startsWith("Income") && d < 0;
              return (
                <tr key={r.label} className="border-t border-border">
                  <td className="py-2.5 pr-3">{r.label}</td>
                  <td className="py-2.5 pl-3 text-right">{fmt(r.now)}</td>
                  <td className="py-2.5 pl-3 text-right">{fmt(r.after)}</td>
                  <td
                    className={`py-2.5 pl-3 text-right ${r.bold ? "font-semibold" : ""} ${good ? "text-good" : ""}`}
                  >
                    {signed(d)}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-border">
              <td className="py-2.5 pr-3">Your marginal tax rate</td>
              <td className="py-2.5 pl-3 text-right">{rate(b.pay.marginalRate)}</td>
              <td className="py-2.5 pl-3 text-right">{rate(a.pay.marginalRate)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CapMeter({ person, year, you }: { person: PersonSacrifice; year: string; you?: boolean }) {
  const a = person.effect.after;
  const room = person.cap + person.carryForward;
  const employer = a.pay.employerSuper - a.salarySacrifice;
  const yours = a.concessional - employer;
  const scale = Math.max(room, a.concessional) || 1;
  const left = a.headroom;
  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-semibold">{you ? "Your" : `${person.name}'s`} concessional cap</h2>
        <span className="num text-sm text-muted">
          {left >= 0 ? (
            <>
              <strong className="text-text">{money(left)}</strong> room left of {money(room)} in{" "}
              {year}
            </>
          ) : (
            <strong className="text-warn">
              {money(-left)} over the {money(room)} cap
            </strong>
          )}
        </span>
      </div>
      <div
        className="my-3 flex h-4 overflow-hidden rounded-full bg-border"
        role="img"
        aria-label={`Employer ${money(employer)}, yours ${money(yours)}, room left ${money(Math.max(0, left))}`}
      >
        <div style={{ width: `${(employer / scale) * 100}%`, background: COLORS.employer }} />
        <div
          style={{
            width: `${(Math.max(0, yours) / scale) * 100}%`,
            background: left < 0 ? "var(--warn)" : COLORS.you,
          }}
        />
      </div>
      <div className="num flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Legend color={COLORS.employer} label={`Employer ${money(employer)}`} />
        <Legend color={COLORS.you} label={`Your sacrifice and contributions ${money(yours)}`} />
        <Legend color="var(--grid)" label={`Room left ${money(Math.max(0, left))}`} />
      </div>
      {person.carryForward > 0 && (
        <p className="num mt-2 text-sm text-muted">
          Includes {money(person.carryForward)} of unused cap carried forward.
        </p>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-2.5 rounded-sm border border-border"
        style={{ background: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function ideaTitle(s: SacrificeSuggestion, who: string, fmt: (c: number) => string, per: string) {
  if (s.kind === "fill-cap") return `Fill ${who} cap: ${fmt(s.extra)} ${per}`;
  return `Bring ${who} taxable income down to ${money(s.taxableIncome ?? 0)}: ${fmt(s.extra)} ${per}`;
}

function Ideas({
  people,
  show,
  fmt,
  onUse,
  you,
}: {
  people: PersonSacrifice[];
  show: ShowPer;
  fmt: (c: number) => string;
  onUse: (id: string, extra: Cents) => void;
  you?: boolean;
}) {
  const ideas = people.flatMap((p) => p.suggestions.map((s) => ({ p, s })));
  if (!ideas.length) return null;
  return (
    <div className={`${card} space-y-3`}>
      <h2 className="font-semibold">Ideas to try</h2>
      {ideas.map(({ p, s }) => {
        const who = you || p.name === "You" ? "your" : `${p.name}'s`;
        const e = s.effect;
        return (
          <div
            key={`${p.id}-${s.kind}`}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
          >
            <div className="min-w-0 flex-[1_1_280px]">
              <p className="font-medium">{ideaTitle(s, who, fmt, perLabel(show))}</p>
              <p className="num mt-1 text-sm text-muted">
                Costs {fmt(e.takeHomeCost)} take-home, saves {fmt(e.taxSaved)} tax and adds{" "}
                {fmt(e.intoSuper)} to super.
                {s.kind === "bracket-edge" &&
                  ` Above that line each dollar saves ${cpd(s.rateAbove ?? 0)} in income tax; below it, less.`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onUse(p.id, s.extra)}
              className="min-h-11 rounded-full border border-outline px-5 text-sm font-medium text-accent hover:bg-accent hover:text-on-accent"
            >
              Use this
            </button>
          </div>
        );
      })}
    </div>
  );
}

function warningText(w: SacrificeWarning): string {
  switch (w.kind) {
    case "over-cap":
      return `That's ${money(w.over)} over the concessional cap. The excess is taxed at the marginal rate (less a 15% offset), so it usually isn't worth it.`;
    case "uses-carry-forward":
      return `This uses ${money(w.amount)} of unused cap carried forward from earlier years.`;
    case "carry-forward-blocked":
      return `Unused cap from earlier years can't be used: the total super balance (${money(w.balance)}) is $500,000 or more.`;
    case "not-worth-it":
      return `At this income, the sacrifice costs more take-home than it adds to super: ${money(-w.netGain)} a year worse off.`;
    case "loses-listo":
      return `This loses ${money(w.amount)} of the low income super tax offset.`;
    case "division-293":
      return `Income plus super is over $250,000, so Division 293 adds ${money(w.amount)} a year in tax on the extra.`;
    case "too-big":
      return "That's more than the pay left, so we've used all of it.";
  }
}

function Warnings({ people, you }: { people: PersonSacrifice[]; you?: boolean }) {
  const items = people.flatMap((p) =>
    p.warnings.map((w) => ({ key: `${p.id}-${w.kind}`, who: p.name, text: warningText(w) })),
  );
  if (!items.length) return null;
  return (
    <div className={`${card} space-y-2`} aria-live="polite">
      {items.map((i) => (
        <p key={i.key} className="text-sm text-warn">
          {!you && <strong>{i.who}: </strong>}
          {i.text}
        </p>
      ))}
    </div>
  );
}

/** Super per $1 of take-home for the next $1,000 (or less, up to the cap) a year. */
function nextRate(p: PersonRow, year: string): number {
  const sp = toSacrificePerson({ ...p, extra: 0 });
  const step = Math.min(100_000, maxExtra(sp, year)) as Cents;
  if (step <= 0) return 0;
  return sacrificeEffect(sp, year, step).superPerDollar;
}

function BudgetSplit({
  result,
  people,
  fmt,
  onUse,
}: {
  result: SacrificeResult;
  people: PersonRow[];
  fmt: (c: number) => string;
  onUse: (split: NonNullable<SacrificeResult["budgetSplit"]>) => void;
}) {
  const split = result.budgetSplit;
  if (!split) return null;
  const name = (id: string) => people.find((p) => p.id === id)?.name || "Someone";
  const used = split.filter((s) => s.extra > 0);
  const cost = split.reduce((s, x) => s + x.takeHomeCost, 0);
  const into = split.reduce((s, x) => s + x.intoSuper, 0);
  const rates = result.people
    .map((p) => ({ name: p.name, rate: p.effect.before.pay.marginalRate }))
    .sort((a, b) => b.rate - a.rate);
  const applied = split.every(
    (s) => Math.round(people.find((p) => p.id === s.id)?.extra ?? 0) === Math.round(s.extra / 100),
  );
  if (!used.length) {
    return (
      <div className="rounded-xl bg-primary-container p-5 text-on-primary-container sm:p-6">
        <p className="text-lg">
          No one has room under their cap for that budget. Try a bigger amount.
        </p>
      </div>
    );
  }
  return (
    <div
      className="space-y-3 rounded-xl bg-primary-container p-5 text-on-primary-container sm:p-6"
      aria-live="polite"
    >
      <p className="text-lg leading-relaxed sm:text-xl">
        Have{" "}
        {used.map((s, i) => (
          <span key={s.id}>
            {i > 0 && (i === used.length - 1 ? " and " : ", ")}
            <strong>{name(s.id)}</strong> sacrifice <strong className="num">{fmt(s.extra)}</strong>
          </span>
        ))}
        . It costs the household <strong className="num">{fmt(cost)}</strong> in take-home pay and
        puts <strong className="num">{fmt(into)}</strong> more into super.
      </p>
      {rates.length > 1 && (
        <p className="text-sm opacity-85">
          The best value comes first: each dollar sacrificed saves{" "}
          {rates.map((r, i) => (
            <span key={r.name}>
              {i > 0 && (i === rates.length - 1 ? " and " : ", ")}
              {cpd(r.rate)} in tax for {r.name}
            </span>
          ))}
          .
        </p>
      )}
      <button
        type="button"
        disabled={applied}
        onClick={() => onUse(split)}
        className="min-h-11 rounded-lg bg-bg px-4 text-sm font-medium text-text disabled:opacity-60"
      >
        {applied ? "Using this split" : "Use this split"}
      </button>
    </div>
  );
}

function HouseholdTable({
  result,
  people,
  fmt,
  show,
}: {
  result: SacrificeResult;
  people: PersonRow[];
  fmt: (c: number) => string;
  show: ShowPer;
}) {
  const rateFor = (p: PersonSacrifice) => {
    if (p.effect.extra > 0) return p.effect.superPerDollar;
    const row = people.find((r) => r.id === p.id);
    return row ? nextRate(row, result.year) : 0;
  };
  const { total } = result;
  return (
    <div className={card}>
      <h2 className="font-semibold">Each person, {perLabel(show)}</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="num w-full min-w-[640px] border-collapse text-[15px]">
          <thead>
            <tr className="text-sm text-muted">
              <th className="py-2 text-left font-medium">Person</th>
              <th className="py-2 text-right font-medium">Extra</th>
              <th className="py-2 text-right font-medium">Take-home cost</th>
              <th className="py-2 text-right font-medium">Into super</th>
              <th className="py-2 text-right font-medium">Super per $1</th>
              <th className="py-2 text-right font-medium">Cap room left, a year</th>
            </tr>
          </thead>
          <tbody>
            {result.people.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="py-3 font-medium">{p.name}</td>
                <td className="py-3 text-right">{fmt(p.effect.extra)}</td>
                <td className="py-3 text-right">{fmt(p.effect.takeHomeCost)}</td>
                <td className={`py-3 text-right ${p.effect.intoSuper > 0 ? "text-good" : ""}`}>
                  {p.effect.intoSuper > 0 ? "+" : ""}
                  {fmt(p.effect.intoSuper)}
                </td>
                <td className="py-3 text-right">
                  {rateFor(p) > 0 ? `$${rateFor(p).toFixed(2)}` : "—"}
                </td>
                <td className={`py-3 text-right ${p.effect.after.headroom < 0 ? "text-warn" : ""}`}>
                  {money(p.effect.after.headroom)}
                  {p.carryForward > 0 && (
                    <span className="block text-xs text-muted">
                      includes {money(p.carryForward)} carried forward
                    </span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-t border-border font-semibold">
              <td className="py-3">Household</td>
              <td className="py-3 text-right">{fmt(total.extra)}</td>
              <td className="py-3 text-right">{fmt(total.takeHomeCost)}</td>
              <td className="py-3 text-right text-good">+{fmt(total.intoSuper)}</td>
              <td className="py-3 text-right">
                {total.takeHomeCost > 0
                  ? `$${(total.intoSuper / total.takeHomeCost).toFixed(2)}`
                  : "—"}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sourceName(url: string): string {
  if (url.includes("super-guarantee")) return "ATO super guarantee";
  if (url.includes("concessional-contributions-cap")) return "ATO concessional cap";
  if (url.includes("low-income-super-tax-offset")) return "ATO LISTO";
  if (url.includes("working-holiday")) return "ATO working holiday rates";
  if (url.includes("tax-cuts")) return "ATO tax cuts";
  if (url.includes("tax-rates-australian-residents")) return "ATO tax rates";
  if (url.includes("study-and-training")) return "ATO study loans";
  if (url.includes("surcharge")) return "ATO Medicare levy surcharge";
  if (url.includes("medicare-levy")) return "ATO Medicare levy";
  return "ATO";
}

function Footer({
  result,
  copied,
  onCopy,
}: {
  result: SacrificeResult;
  copied: boolean;
  onCopy: () => void;
}) {
  const sources = [...new Set(result.sources)];
  return (
    <div className="space-y-2 text-sm text-muted">
      <p>
        Uses the ATO&apos;s {result.year} tax and super rules: income tax, the Medicare levy and
        surcharge, study loans, 15% contributions tax, Division 293 and the low income super tax
        offset. It doesn&apos;t cover the tax on contributions over the cap, other income or the
        seniors offset. This is general information, not financial advice.
      </p>
      {result.rulesCarriedForward && <p>Using the latest published rules for {result.year}.</p>}
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        <span>Sources:</span>
        {sources.map((s) => (
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
