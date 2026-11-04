"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type Idea, ideas, snapshot, type Tile } from "@/lib/dashboard";
import {
  buildJourney,
  type DebtKind,
  defaultProfile,
  type JourneyStep,
  otherTools,
  type Profile,
  parseProfile,
  planProgress,
  storeProfile,
} from "@/lib/profile";
import {
  emptySaved,
  forgetAll,
  readSaved,
  rememberAgain,
  type SavedData,
  saveProfile,
  type ToolKey,
} from "@/lib/saved";
import { AREAS, TOOLS, tool } from "@/lib/tools";

type View = "questions" | "dashboard" | "all";

const card = "rounded-2xl border border-border bg-surface";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-[15px] font-semibold text-white hover:opacity-90";
const secondary =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium hover:border-accent";
const href = (key: ToolKey) => `${tool(key).href}/`;

export function Home() {
  const [data, setData] = useState<SavedData>(() => emptySaved());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [view, setView] = useState<View>("questions");

  useEffect(() => {
    const load = () => {
      const d = readSaved();
      const p = parseProfile(d.profile);
      setData(d);
      setProfile((was) => p ?? was);
      return p;
    };
    if (load()) setView("dashboard");
    // Another tab may fill in a tool or change the answers.
    const onStorage = () => load();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const finish = (p: Profile) => {
    saveProfile(storeProfile(p));
    setProfile(p);
    setData(readSaved());
    setView("dashboard");
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh">
      <SiteHeader
        view={view}
        hasProfile={profile !== null}
        onDashboard={() => setView(profile ? "dashboard" : "questions")}
        onAll={() => setView("all")}
        onAnswers={() => setView("questions")}
        remembering={data.remember}
      />
      {view === "questions" && (
        <Questions
          initial={profile ?? defaultProfile()}
          editing={profile !== null}
          remembering={data.remember}
          onRemember={() => {
            rememberAgain();
            setData(readSaved());
          }}
          onDone={finish}
          onSkip={() => setView("all")}
        />
      )}
      {view === "questions" && !profile && <ToolIndex />}
      {view === "dashboard" && profile && (
        <Dashboard
          profile={profile}
          data={data}
          onEdit={() => setView("questions")}
          onForget={() => {
            forgetAll();
            setData(readSaved());
            setProfile(null);
            setView("questions");
          }}
        />
      )}
      {view === "all" && (
        <AllTools hasProfile={profile !== null} onAsk={() => setView("questions")} />
      )}
    </div>
  );
}

function SiteHeader(props: {
  view: View;
  hasProfile: boolean;
  remembering: boolean;
  onDashboard: () => void;
  onAll: () => void;
  onAnswers: () => void;
}) {
  const navBtn = (active: boolean) =>
    `min-h-11 text-[15px] ${active ? "font-semibold text-text" : "text-muted hover:text-text"}`;
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-7 gap-y-1 px-4 py-2 sm:px-6">
        <span className="text-xl font-bold tracking-tight">Budgy</span>
        <nav aria-label="Main" className="flex flex-wrap gap-x-5">
          {props.hasProfile && (
            <button
              type="button"
              className={navBtn(props.view === "dashboard")}
              onClick={props.onDashboard}
            >
              My dashboard
            </button>
          )}
          <button type="button" className={navBtn(props.view === "all")} onClick={props.onAll}>
            All tools
          </button>
          {props.hasProfile && (
            <button
              type="button"
              className={navBtn(props.view === "questions")}
              onClick={props.onAnswers}
            >
              My answers
            </button>
          )}
        </nav>
        <span className="ml-auto text-[13px] text-muted">
          {props.remembering ? "Saved on this device only" : "Free, no sign-up"}
        </span>
      </div>
    </header>
  );
}

// ── Questions ───────────────────────────────────────────────────────────────

interface Option<T> {
  value: T;
  label: string;
}

function Chips<T extends string>(props: {
  options: Option<T>[];
  isOn: (v: T) => boolean;
  onPick: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.options.map((o) => {
        const on = props.isOn(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => props.onPick(o.value)}
            className={`min-h-11 rounded-full px-4 text-[15px] transition ${
              on
                ? "border-2 border-accent bg-accent/10 font-semibold text-text"
                : "border border-border bg-surface hover:border-accent"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Question(props: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <fieldset className={`${card} px-5 py-4`}>
      <legend className="sr-only">{props.title}</legend>
      <p aria-hidden="true" className="text-base font-semibold">
        {props.title}
      </p>
      <p className="mt-0.5 mb-3 text-[13px] text-muted">{props.hint}</p>
      {props.children}
    </fieldset>
  );
}

const DEBT_OPTIONS: Option<DebtKind | "none">[] = [
  { value: "help", label: "HELP or HECS" },
  { value: "card", label: "Credit card" },
  { value: "car", label: "Car loan" },
  { value: "personal", label: "Personal loan" },
  { value: "none", label: "None of these" },
];

function Questions(props: {
  initial: Profile;
  editing: boolean;
  remembering: boolean;
  onRemember: () => void;
  onDone: (p: Profile) => void;
  onSkip: () => void;
}) {
  const [p, setP] = useState(props.initial);
  const [noneOfThese, setNone] = useState(props.editing && props.initial.debts.length === 0);
  const set =
    <K extends keyof Profile>(k: K) =>
    (v: Profile[K]) =>
      setP((s) => ({ ...s, [k]: v }));
  const journey = useMemo(() => buildJourney(p), [p]);

  const pickDebt = (v: DebtKind | "none") => {
    if (v === "none") {
      setNone((n) => !n);
      setP((s) => ({ ...s, debts: [] }));
      return;
    }
    setNone(false);
    setP((s) => ({
      ...s,
      debts: s.debts.includes(v) ? s.debts.filter((d) => d !== v) : [...s.debts, v],
    }));
  };

  return (
    <main className="mx-auto flex max-w-6xl flex-wrap items-start gap-8 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <section aria-labelledby="q-h" className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <div>
          <h1 id="q-h" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {props.editing ? "Your answers" : "Money tools that fit your life"}
          </h1>
          <p className="mt-2 max-w-xl text-[17px] text-muted">
            {props.editing
              ? "Change anything and your dashboard and plan change with it."
              : "Tell us a little about your situation and we'll set up your own dashboard. Five taps, no numbers yet. Your answers stay on this device."}
          </p>
        </div>

        <Question
          title="How do you earn?"
          hint="A salary means we can work out your take-home pay and your super."
        >
          <Chips
            options={[
              { value: "salary", label: "Salary or wages" },
              { value: "self", label: "Self-employed" },
              { value: "none", label: "Not working right now" },
            ]}
            isOn={(v) => p.earn === v}
            onPick={set("earn")}
          />
        </Question>
        <Question title="Where are you with a home?" hint="Pick the closest.">
          <Chips
            options={[
              { value: "loan", label: "I have a home loan" },
              { value: "buying", label: "Saving or buying" },
              { value: "neither", label: "Renting or neither" },
            ]}
            isOn={(v) => p.home === v}
            onPick={set("home")}
          />
        </Question>
        <Question title="Any of these debts?" hint="Pick all that apply.">
          <Chips
            options={DEBT_OPTIONS}
            isOn={(v) => (v === "none" ? noneOfThese : p.debts.includes(v))}
            onPick={pickDebt}
          />
        </Question>
        <Question title="A novated lease?" hint="Leasing a car through your employer.">
          <Chips
            options={[
              { value: "have", label: "I have one" },
              { value: "thinking", label: "Thinking about it" },
              { value: "no", label: "No" },
            ]}
            isOn={(v) => p.lease === v}
            onPick={set("lease")}
          />
        </Question>
        <Question
          title="Who are you planning for?"
          hint="Partners can share a loan and plan super together."
        >
          <Chips
            options={[
              { value: "me", label: "Just me" },
              { value: "two", label: "Me and a partner" },
            ]}
            isOn={(v) => p.who === v}
            onPick={set("who")}
          />
        </Question>
      </section>

      <aside
        aria-labelledby="p-h"
        className={`${card} min-w-0 flex-[1_1_320px] p-5 lg:sticky lg:top-6`}
      >
        <h2 id="p-h" className="text-lg font-semibold">
          Your plan will be
        </h2>
        <p className="mt-1 mb-3 text-[13px] text-muted">
          {journey.length} tools, in this order. Every other tool stays one click away.
        </p>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px]">
          {journey.map((s) => (
            <li key={s.key}>
              <span className="font-medium">{tool(s.key).name}</span>{" "}
              <span className="text-[13px] text-muted">{s.why}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" className={`${primary} min-h-12`} onClick={() => props.onDone(p)}>
            {props.editing ? "Update my dashboard" : "Set up my dashboard"}
          </button>
          <button
            type="button"
            className="min-h-11 text-sm text-accent hover:underline"
            onClick={props.onSkip}
          >
            Skip and show me every tool
          </button>
        </div>
        {!props.remembering && (
          <p className="mt-3 text-[13px] text-muted">
            This device isn't remembering your inputs, so your dashboard will be gone next visit.{" "}
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={props.onRemember}
            >
              Remember them
            </button>
          </p>
        )}
      </aside>
    </main>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────

function Dashboard(props: {
  profile: Profile;
  data: SavedData;
  onEdit: () => void;
  onForget: () => void;
}) {
  const { profile, data } = props;
  const journey = useMemo(() => buildJourney(profile), [profile]);
  const inPlan = useMemo(() => new Set(journey.map((s) => s.key)), [journey]);
  const tiles = useMemo(() => snapshot(data).filter((t) => inPlan.has(t.key)), [data, inPlan]);
  const found = useMemo(() => ideas(data, inPlan), [data, inPlan]);
  const progress = planProgress(journey, data.tools);
  const others = otherTools(profile);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Your money at a glance
          </h1>
          <p className="mt-2 max-w-2xl text-muted">{summary(profile)}</p>
        </div>
        <button type="button" className={secondary} onClick={props.onEdit}>
          Edit my answers
        </button>
      </section>

      <Snapshot tiles={tiles} journey={journey} />
      <Plan journey={journey} done={progress.done} next={progress.next} />
      {found.length > 0 && <Ideas ideas={found} />}
      <YourTools journey={journey} done={progress.done} />

      {others.length > 0 && (
        <section aria-labelledby="more-h">
          <h2 id="more-h" className="text-xl font-semibold">
            More tools
          </h2>
          <p className="mt-1 text-sm text-muted">
            Not in your answers, but they're all here if you want them.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2.5">
            {others.map((k) => (
              <li key={k}>
                <Link
                  href={href(k)}
                  className={`${card} flex min-h-14 flex-col justify-center rounded-xl px-4 py-2 hover:border-accent`}
                >
                  <span className="text-[15px] font-medium">{tool(k).name}</span>
                  <span className="text-xs text-muted">
                    {AREAS.find((a) => a.area === tool(k).area)?.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-[13px] text-muted">
        <span>General information only, not financial advice.</span>
        <button type="button" className="text-accent hover:underline" onClick={props.onForget}>
          Forget everything on this device
        </button>
      </footer>
    </main>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One plain sentence of what the answers were. */
export function summary(p: Profile): string {
  const bits: string[] = [];
  if (p.earn === "salary") bits.push("a salary");
  if (p.earn === "self") bits.push("self-employed income");
  if (p.home === "loan") bits.push("a home loan");
  if (p.home === "buying") bits.push("buying a home");
  if (p.debts.includes("help")) bits.push("HELP");
  const other = p.debts.filter((d) => d !== "help").length;
  if (other) bits.push(other === 1 ? "one other debt" : `${other} other debts`);
  if (p.lease === "have") bits.push("a novated lease");
  if (p.who === "two") bits.push("planning with a partner");
  if (!bits.length) return "Built from your answers. Change them any time.";
  const list = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(", ")} and ${bits.at(-1)}`;
  return `Built from what you told us: ${list}. Change your answers any time.`;
}

function Snapshot(props: { tiles: Tile[]; journey: JourneyStep[] }) {
  if (!props.tiles.length) {
    const first = props.journey[0];
    return (
      <section aria-label="Snapshot" className={`${card} p-5`}>
        <p className="font-medium">Your numbers will show up here.</p>
        <p className="mt-1 text-sm text-muted">
          Fill in a tool and its numbers stay on this device, ready for the next one.
        </p>
        {first && (
          <Link href={href(first.key)} className={`${primary} mt-4`}>
            Start with {tool(first.key).name.toLowerCase()}
          </Link>
        )}
      </section>
    );
  }
  return (
    <section
      aria-label="Snapshot"
      className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]"
    >
      {props.tiles.map((t) => (
        <article key={t.key} className={`${card} flex flex-col gap-1.5 rounded-xl px-5 py-4`}>
          <div className="flex items-center justify-between text-[13px] font-medium text-muted">
            <span>{t.label}</span>
            <Link href={href(t.key)} className="text-accent hover:underline">
              Update
            </Link>
          </div>
          <div className="text-[28px] font-semibold tracking-tight tabular-nums">{t.value}</div>
          <div className="text-[13px] text-muted">{t.sub}</div>
        </article>
      ))}
    </section>
  );
}

function Plan(props: { journey: JourneyStep[]; done: Set<ToolKey>; next: ToolKey | null }) {
  const { journey, done, next } = props;
  const pct = journey.length ? Math.round((done.size / journey.length) * 100) : 0;
  return (
    <section aria-labelledby="plan-h" className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plan-h" className="text-xl font-semibold">
          Your plan
        </h2>
        <span className="text-sm text-muted">
          {done.size} of {journey.length} steps done
        </span>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--grid)]"
        role="progressbar"
        aria-label="Plan progress"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-5 grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
        {journey.map((s, i) => {
          const isDone = done.has(s.key);
          const isNext = s.key === next;
          return (
            <li key={s.key}>
              <Link
                href={href(s.key)}
                className={`flex min-h-[76px] flex-col gap-1 rounded-xl p-3 ${
                  isNext
                    ? "border-2 border-accent bg-accent/5"
                    : isDone
                      ? "border border-border bg-surface"
                      : "border border-dashed border-border bg-bg"
                } hover:border-accent`}
              >
                <span
                  className={`text-xs font-semibold ${
                    isNext ? "text-accent" : isDone ? "text-good" : "text-muted"
                  }`}
                >
                  {isNext ? "Up next" : isDone ? "Done" : `Step ${i + 1}`}
                </span>
                <span className="text-sm font-medium">{tool(s.key).name}</span>
              </Link>
            </li>
          );
        })}
      </ol>
      {next ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={href(next)} className={primary}>
            Next: {tool(next).name}
          </Link>
          <span className="text-sm text-muted">
            {capitalise(journey.find((s) => s.key === next)?.why ?? "")}. Anything you've already
            entered carries over.
          </span>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">
          You've been through every step. Come back when something changes, or try the other tools
          below.
        </p>
      )}
    </section>
  );
}

function Ideas(props: { ideas: Idea[] }) {
  return (
    <section aria-labelledby="ideas-h">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ideas-h" className="text-xl font-semibold">
          Ways to get ahead
        </h2>
        <span className="text-[13px] text-muted">Rough estimates from your saved numbers</span>
      </div>
      <div className="mt-3 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
        {props.ideas.map((i) => (
          <article key={i.key} className={`${card} flex flex-col gap-2.5 rounded-xl p-5`}>
            <span className="self-start rounded-full bg-bg px-2.5 py-0.5 text-xs font-semibold text-muted">
              {i.area}
            </span>
            <div className="text-2xl font-semibold tracking-tight text-good">{i.headline}</div>
            <p className="text-[15px] leading-relaxed">{i.text}</p>
            <Link
              href={href(i.key)}
              className="mt-auto text-sm font-semibold text-accent hover:underline"
            >
              {tool(i.key).name}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function YourTools(props: { journey: JourneyStep[]; done: Set<ToolKey> }) {
  const keys = new Set(props.journey.map((s) => s.key));
  const groups = AREAS.map((a) => ({
    ...a,
    tools: TOOLS.filter((t) => t.area === a.area && keys.has(t.key)),
  })).filter((g) => g.tools.length);
  return (
    <section aria-labelledby="tools-h">
      <h2 id="tools-h" className="text-xl font-semibold">
        Your tools
      </h2>
      <div className="mt-3 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
        {groups.map((g) => (
          <article key={g.area} className={`${card} rounded-xl px-5 py-4`}>
            <h3 className="mb-2 text-[13px] font-semibold tracking-wider text-muted uppercase">
              {g.name}
            </h3>
            <ul>
              {g.tools.map((t) => (
                <li key={t.key} className="border-t border-[var(--grid)]">
                  <Link
                    href={href(t.key)}
                    className="flex min-h-12 items-center justify-between gap-3 text-[15px] hover:text-accent"
                  >
                    <span>{t.name}</span>
                    {props.done.has(t.key) && (
                      <span className="text-xs whitespace-nowrap text-good">Filled in</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Every tool as plain links, so the first visit still shows what's here. */
function ToolIndex() {
  return (
    <section
      aria-labelledby="index-h"
      className="mx-auto max-w-6xl border-t border-border px-4 pt-8 pb-16 sm:px-6"
    >
      <h2 id="index-h" className="text-lg font-semibold">
        Or jump straight to a tool
      </h2>
      <div className="mt-4 grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
        {AREAS.map((a) => (
          <div key={a.area}>
            <h3 className="text-[13px] font-semibold tracking-wider text-muted uppercase">
              {a.name}
            </h3>
            <ul className="mt-2 flex flex-col gap-1">
              {TOOLS.filter((t) => t.area === a.area).map((t) => (
                <li key={t.key}>
                  <Link href={`${t.href}/`} className="text-[15px] text-accent hover:underline">
                    {t.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Every tool ──────────────────────────────────────────────────────────────

function AllTools(props: { hasProfile: boolean; onAsk: () => void }) {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Every tool</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Fast, accurate calculators with no sign-up. Your numbers never leave your device.
          </p>
        </div>
        {!props.hasProfile && (
          <button type="button" className={secondary} onClick={props.onAsk}>
            Tailor this to me
          </button>
        )}
      </section>
      {AREAS.map((a) => (
        <section key={a.area} aria-labelledby={`area-${a.area}`}>
          <h2 id={`area-${a.area}`} className="text-xl font-semibold">
            {a.name}
          </h2>
          <ul className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {TOOLS.filter((t) => t.area === a.area).map((t) => (
              <li key={t.key}>
                <Link
                  href={`${t.href}/`}
                  className={`${card} block h-full rounded-xl p-4 hover:border-accent`}
                >
                  <span className="font-medium">{t.name}</span>
                  <span className="mt-1 block text-sm text-muted">{t.blurb}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
