"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BalanceChart } from "@/components/BalanceChart";
import { CheckIcon, ChevronIcon } from "@/components/Icons";
import {
  type CashFlow,
  cashFlow,
  type DebtLine,
  debtList,
  type Idea,
  ideas,
  type LoanOutlook,
  loanOutlook,
  savedLoan,
} from "@/lib/dashboard";
import { money, monthYearShort } from "@/lib/format";
import { HOME_HREF } from "@/lib/nav";
import { buildJourney, type JourneyStep, type Profile, planProgress } from "@/lib/profile";
import type { SavedData, ToolKey } from "@/lib/saved";
import { tool } from "@/lib/tools";

const card = "flex min-w-0 flex-col gap-3.5 rounded-[28px] bg-surface p-5 sm:p-6";
const caption = "text-sm font-medium text-muted";
const textLink =
  "inline-flex min-h-11 items-center self-start text-sm font-semibold text-accent hover:underline";
const primary =
  "inline-flex min-h-11 items-center justify-center self-start rounded-full bg-accent px-6 text-[15px] font-semibold text-on-accent hover:opacity-90";
const href = (key: ToolKey) => `${tool(key).href}/`;

/** Everything the dashboard draws, worked out from the saved inputs. */
function useDashboard(profile: Profile, data: SavedData) {
  return useMemo(() => {
    const journey = buildJourney(profile);
    const inPlan = new Set(journey.map((s) => s.key));
    const loan = inPlan.has("mortgage") || inPlan.has("rates") ? savedLoan(data) : null;
    return {
      journey,
      progress: planProgress(journey, data.tools),
      flow: cashFlow(data),
      outlook: loan ? loanOutlook(loan) : null,
      debts: debtList(data).filter((d) => inPlan.has(d.key)),
      found: ideas(data, inPlan),
    };
  }, [profile, data]);
}

export function Dashboard({ profile, data }: { profile: Profile; data: SavedData }) {
  const { journey, progress, flow, outlook, debts, found } = useDashboard(profile, data);
  const [best, ...rest] = found;
  const empty = !flow && !outlook && !debts.length && !best;

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
      <h1 className="text-[28px] font-semibold tracking-tight sm:text-4xl">
        Your money at a glance
      </h1>

      {empty ? (
        <Start journey={journey} />
      ) : (
        <div className="flex flex-wrap gap-4 sm:gap-5">
          {flow ? <CashFlowCard flow={flow} /> : journey.some((s) => s.key === "pay") && <AddPay />}
          {best && <BestMove idea={best} />}
          {outlook && <LoanCard o={outlook} />}
          {debts.length > 0 && <DebtsCard debts={debts} />}
        </div>
      )}

      {rest.length > 0 && <MoreIdeas ideas={rest} />}
      <PlanRow journey={journey} done={progress.done} next={progress.next} />

      <p className="text-center text-xs text-muted sm:text-left">
        General information only, not financial advice. Rough estimates from the numbers saved on
        this device.
      </p>
    </main>
  );
}

function Start({ journey }: { journey: JourneyStep[] }) {
  const first = journey[0];
  return (
    <section className={card}>
      <p className="text-lg font-semibold">Your numbers will show up here.</p>
      <p className="text-[15px] text-muted">
        Fill in a tool and your dashboard draws where your pay goes, when your loans are paid off
        and the best ways to get ahead.
      </p>
      {first && (
        <Link href={href(first.key)} className={primary}>
          Start with {tool(first.key).name.toLowerCase()}
        </Link>
      )}
    </section>
  );
}

// ── Cash flow ───────────────────────────────────────────────────────────────

// Teal, grey, orange and pale apricot: told apart by lightness as well as hue, and never the green of "left over".
const FLOW_COLORS = [
  "var(--series-a)",
  "var(--series-base)",
  "var(--series-b)",
  "var(--tertiary-container)",
];

function CashFlowCard({ flow }: { flow: CashFlow }) {
  if (flow.left === null)
    return (
      <section aria-labelledby="cf-h" className={`${card} flex-[2_1_520px]`}>
        <h2 id="cf-h" className={caption}>
          Take-home each fortnight
        </h2>
        <p className="num text-[44px] leading-none font-semibold tracking-tight">
          {money(flow.income)}
        </p>
        <p className="text-[15px] text-muted">
          Add your bills and spending to see where it goes and what's left over.
        </p>
        <Link href={href("budget")} className={primary}>
          Open the budget planner
        </Link>
      </section>
    );

  const short = flow.left < 0;
  const parts = flow.parts.map((p, i) => ({ ...p, color: FLOW_COLORS[i % FLOW_COLORS.length] }));
  const all = short
    ? parts
    : [...parts, { label: "Left over", amount: flow.left, color: "var(--good)" }];
  const described = all.map((p) => `${p.label} ${money(p.amount)}`).join(", ");

  return (
    <section aria-labelledby="cf-h" className={`${card} flex-[2_1_520px]`}>
      <h2 id="cf-h" className={caption}>
        {short ? "Short each fortnight" : "Left over each fortnight"}
      </h2>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={`num text-[44px] leading-none font-semibold tracking-tight sm:text-5xl ${
            short ? "text-warn" : ""
          }`}
        >
          {money(Math.abs(flow.left))}
        </span>
        <span className="text-sm text-muted">of {money(flow.income)} take-home</span>
      </p>
      {all.length > 0 && (
        <>
          <div
            role="img"
            aria-label={`Where take-home pay goes each fortnight: ${described}`}
            className="flex h-4 gap-[3px] overflow-hidden rounded-full sm:h-5"
          >
            {all.map((p) => (
              <div key={p.label} style={{ flexGrow: Math.max(0, p.amount), background: p.color }} />
            ))}
          </div>
          <ul className="grid gap-x-5 gap-y-2.5 text-sm [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
            {all.map((p) => (
              <li key={p.label} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: p.color }}
                />
                <span className="min-w-0 flex-1 truncate text-muted">{p.label}</span>
                <span className="num font-medium">{money(p.amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {short && (
        <p className="text-sm text-muted">
          Your budget spends more than comes in. The budget planner shows where it goes.
        </p>
      )}
      <Link href={href("budget")} className={textLink}>
        Open the budget planner
      </Link>
    </section>
  );
}

function AddPay() {
  return (
    <section className={`${card} flex-[2_1_520px]`}>
      <h2 className={caption}>Left over each fortnight</h2>
      <p className="text-[15px]">
        Start with your pay and this shows what comes in, where it goes and what's left over.
      </p>
      <Link href={href("pay")} className={primary}>
        Work out my take-home pay
      </Link>
    </section>
  );
}

// ── Best move and ideas ─────────────────────────────────────────────────────

function BestMove({ idea }: { idea: Idea }) {
  return (
    <section
      aria-labelledby="mv-h"
      className={`${card} flex-[1_1_300px] bg-primary-container text-on-primary-container`}
    >
      <h2 id="mv-h" className="text-[13px] font-semibold tracking-wider uppercase">
        Your best move · {idea.area}
      </h2>
      <p className="text-[26px] leading-tight font-semibold tracking-tight">{idea.headline}</p>
      <p className="text-[15px] leading-relaxed">{idea.text}</p>
      <Link href={href(idea.key)} className={`${primary} mt-auto`}>
        {tool(idea.key).name}
      </Link>
    </section>
  );
}

function IdeaCard({ idea }: { idea: Idea }) {
  return (
    <Link
      href={href(idea.key)}
      className="flex min-w-0 flex-col gap-1.5 rounded-[20px] bg-surface p-4 hover:outline hover:outline-accent sm:p-5"
    >
      <span className="text-xs font-semibold text-muted">{idea.area}</span>
      <span className="text-xl font-semibold tracking-tight text-good">{idea.headline}</span>
      <span className="text-sm leading-relaxed">{idea.text}</span>
      <span className="mt-auto pt-1 text-sm font-semibold text-accent">{tool(idea.key).name}</span>
    </Link>
  );
}

function MoreIdeas({ ideas: list }: { ideas: Idea[] }) {
  return (
    <section aria-labelledby="more-h" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="more-h" className="text-lg font-semibold">
          More ways to get ahead
        </h2>
        <Link href={HOME_HREF.ideas} className={textLink}>
          See all
        </Link>
      </div>
      {/* A swipeable row on phones, a grid on wider screens. */}
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:[grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
        {list.map((i) => (
          <div key={i.key} className="flex w-[240px] shrink-0 snap-start sm:w-auto">
            <IdeaCard idea={i} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Home loan and debts ─────────────────────────────────────────────────────

function LoanCard({ o }: { o: LoanOutlook }) {
  const sooner = o.more.payoffDate < o.now.payoffDate;
  const series = [
    {
      name: "As you are",
      color: "var(--series-a)",
      points: o.now.balances,
      payoffDate: o.now.payoffDate,
    },
    {
      name: `$${o.extra} extra ${o.per}`,
      color: "var(--good)",
      points: o.more.balances,
      payoffDate: o.more.payoffDate,
    },
  ];
  return (
    <section aria-labelledby="ln-h" className={`${card} flex-[2_1_520px]`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="ln-h" className={caption}>
          Home loan paid off
        </h2>
        <span className="text-[13px] text-muted">
          {money(o.loan.balance * 100)} at {o.loan.ratePct}%, {money(o.repayment)} {o.per}
        </span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[32px] leading-none font-semibold tracking-tight">
          {monthYearShort(o.now.payoffDate)}
        </span>
        {sooner && o.saved > 0 && (
          <span className="text-sm font-semibold text-good">
            {monthYearShort(o.more.payoffDate)} with ${o.extra} extra {o.per}, {money(o.saved)} less
            interest
          </span>
        )}
      </p>
      <BalanceChart
        series={series}
        label={`Home loan balance over time, as you are and with $${o.extra} extra ${o.per}`}
      />
      <Link href={href("mortgage")} className={textLink}>
        Try your own what-if
      </Link>
    </section>
  );
}

function DebtsCard({ debts }: { debts: DebtLine[] }) {
  const total = debts.reduce((t, d) => t + d.balance, 0);
  const tools = [...new Set(debts.map((d) => d.key))];
  return (
    <section aria-labelledby="dt-h" className={`${card} flex-[1_1_300px]`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="dt-h" className={caption}>
          Debts you owe
        </h2>
        <span className="num text-[13px] text-muted">{money(total)} in all</span>
      </div>
      <ul className="flex flex-col gap-3.5">
        {debts.map((d, i) => (
          <li key={`${d.name}-${i}`} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-[15px]">
              <span className="min-w-0 truncate">{d.name}</span>
              <span className="num font-medium">{money(d.balance)}</span>
            </div>
            <div aria-hidden="true" className="h-2 rounded-full bg-surface-container">
              <div
                className="h-2 rounded-full bg-[var(--series-b)]"
                style={{ width: `${Math.max(3, (d.balance / total) * 100)}%` }}
              />
            </div>
            <span className="text-[13px] text-muted">{d.note}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Bars show each debt's share of what you owe.</p>
      <div className="mt-auto flex flex-wrap gap-x-5">
        {tools.map((k) => (
          <Link key={k} href={href(k)} className={textLink}>
            {tool(k).name}
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Plan ────────────────────────────────────────────────────────────────────

function PlanRow(props: { journey: JourneyStep[]; done: Set<ToolKey>; next: ToolKey | null }) {
  const { journey, done, next } = props;
  const total = journey.length;
  const frac = total ? done.size / total : 0;
  const C = 2 * Math.PI * 16;
  const target = next ? href(next) : HOME_HREF.tools;
  return (
    <Link
      href={target}
      className="flex min-h-16 items-center gap-4 rounded-[20px] bg-surface px-4 py-3 hover:outline hover:outline-accent"
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center text-good">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="absolute">
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="var(--surface-container)"
            strokeWidth="5"
          />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke={next ? "var(--accent)" : "var(--good)"}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${frac * C} ${C}`}
            transform="rotate(-90 20 20)"
          />
        </svg>
        {!next && <CheckIcon size={18} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold">
          {next ? `Next in your plan: ${tool(next).name}` : "Your plan is done"}
        </span>
        <span className="text-[13px] text-muted">
          {done.size} of {total} tools filled in.{" "}
          {next ? "Anything you've entered carries over." : "Come back when something changes."}
        </span>
      </span>
      <ChevronIcon className="shrink-0 text-muted" />
    </Link>
  );
}

// ── The Ideas tab ───────────────────────────────────────────────────────────

export function IdeasView({ profile, data }: { profile: Profile | null; data: SavedData }) {
  const found = useMemo(() => {
    if (!profile) return [];
    const inPlan = new Set(buildJourney(profile).map((s) => s.key));
    return ideas(data, inPlan);
  }, [profile, data]);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-4xl">Ways to get ahead</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Rough estimates from the numbers saved on this device, best first.
        </p>
      </div>
      {found.length ? (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {found.map((i) => (
            <IdeaCard key={i.key} idea={i} />
          ))}
        </div>
      ) : (
        <section className={card}>
          <p className="text-lg font-semibold">No ideas yet.</p>
          <p className="text-[15px] text-muted">
            {profile
              ? "Fill in your pay, home loan or debts and the ideas that could save you money show up here."
              : "Answer a few questions and fill in a tool or two, and the ideas that could save you money show up here."}
          </p>
          <Link href={profile ? HOME_HREF.dashboard : HOME_HREF.settings} className={primary}>
            {profile ? "Back to my dashboard" : "Set up my dashboard"}
          </Link>
        </section>
      )}
    </main>
  );
}
