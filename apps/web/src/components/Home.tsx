"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Chips,
  DEBT_OPTIONS,
  EARN_OPTIONS,
  HOME_OPTIONS,
  LEASE_OPTIONS,
  toggleDebt,
  WHO_OPTIONS,
} from "@/components/answers";
import { Dashboard, IdeasView } from "@/components/Dashboard";
import { SettingsView } from "@/components/SettingsView";
import { ToolsView } from "@/components/ToolsView";
import { HOME_HREF, type HomeView, SAVED_CHANGED, viewParam } from "@/lib/nav";
import {
  buildJourney,
  defaultProfile,
  type Profile,
  parseProfile,
  storeProfile,
} from "@/lib/profile";
import {
  emptySaved,
  forgetAll,
  readSaved,
  rememberAgain,
  type SavedData,
  saveProfile,
} from "@/lib/saved";
import { startClock } from "@/lib/state";
import { AREAS, TOOLS, tool } from "@/lib/tools";

const card = "rounded-2xl border border-border bg-surface";
const primary =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-[15px] font-medium text-on-accent hover:opacity-90";

export function Home() {
  const router = useRouter();
  const asked = viewParam(useSearchParams().get("view"));
  const [data, setData] = useState<SavedData>(() => emptySaved());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    startClock();
    const load = () => {
      const d = readSaved();
      setData(d);
      setProfile(parseProfile(d.profile));
    };
    load();
    setLoaded(true);
    // Another tab may fill in a tool or change the answers.
    window.addEventListener("storage", load);
    return () => window.removeEventListener("storage", load);
  }, []);

  const go = (to: HomeView) => {
    router.push(HOME_HREF[to]);
    window.scrollTo({ top: 0 });
  };
  const changed = () => {
    setData(readSaved());
    window.dispatchEvent(new Event(SAVED_CHANGED));
  };
  const save = (p: Profile) => {
    saveProfile(storeProfile(p));
    setProfile(p);
    changed();
  };
  const remember = () => {
    rememberAgain();
    changed();
  };
  const forget = () => {
    forgetAll();
    setProfile(null);
    changed();
    go("dashboard");
  };

  if (asked === "tools") return <ToolsView profile={profile} data={data} />;
  if (asked === "ideas") return <IdeasView profile={profile} data={data} />;
  if (asked === "settings" && profile)
    return (
      <SettingsView
        profile={profile}
        data={data}
        onChange={save}
        onRemember={remember}
        onForget={forget}
      />
    );
  if (profile && asked !== "settings") return <Dashboard profile={profile} data={data} />;

  return (
    <div className="min-h-dvh">
      <Questions
        // A fresh form once the saved data is in.
        key={loaded ? "loaded" : "new"}
        initial={defaultProfile()}
        remembering={data.remember}
        onRemember={remember}
        onDone={(p) => {
          save(p);
          go("dashboard");
        }}
        onSkip={() => go("tools")}
      />
      <ToolIndex />
    </div>
  );
}

/**
 * The first-visit page as static HTML, shown until the browser has read the
 * URL and saved answers. It's what crawlers and people without JavaScript see.
 */
export function HomeFallback() {
  const noop = () => {};
  return (
    <div className="min-h-dvh">
      <Questions
        initial={defaultProfile()}
        remembering
        onRemember={noop}
        onDone={noop}
        onSkip={noop}
      />
      <ToolIndex />
    </div>
  );
}

// ── First visit: the questions ──────────────────────────────────────────────

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

function Questions(props: {
  initial: Profile;
  remembering: boolean;
  onRemember: () => void;
  onDone: (p: Profile) => void;
  onSkip: () => void;
}) {
  const [p, setP] = useState(props.initial);
  const [noneOfThese, setNone] = useState(false);
  const set =
    <K extends keyof Profile>(k: K) =>
    (v: Profile[K]) =>
      setP((s) => ({ ...s, [k]: v }));
  const journey = useMemo(() => buildJourney(p), [p]);

  return (
    <main className="mx-auto flex max-w-6xl flex-wrap items-start gap-8 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
      <section aria-labelledby="q-h" className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
        <div>
          <h1 id="q-h" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Money tools that fit your life
          </h1>
          <p className="mt-2 max-w-xl text-[17px] text-muted">
            Tell us a little about your situation and we'll set up your own dashboard. Five taps, no
            numbers yet. Your answers stay on this device, and you can change them in Settings.
          </p>
        </div>

        <Question
          title="How do you earn?"
          hint="A salary means we can work out your take-home pay and your super."
        >
          <Chips options={EARN_OPTIONS} isOn={(v) => p.earn === v} onPick={set("earn")} />
        </Question>
        <Question title="Where are you with a home?" hint="Pick the closest.">
          <Chips options={HOME_OPTIONS} isOn={(v) => p.home === v} onPick={set("home")} />
        </Question>
        <Question title="Any of these debts?" hint="Pick all that apply.">
          <Chips
            options={DEBT_OPTIONS}
            isOn={(v) => (v === "none" ? noneOfThese : p.debts.includes(v))}
            onPick={(v) => {
              setNone(v === "none" ? !noneOfThese : false);
              setP((s) => ({ ...s, debts: toggleDebt(s.debts, v) }));
            }}
          />
        </Question>
        <Question title="A novated lease?" hint="Leasing a car through your employer.">
          <Chips options={LEASE_OPTIONS} isOn={(v) => p.lease === v} onPick={set("lease")} />
        </Question>
        <Question
          title="Who are you planning for?"
          hint="Partners can share a loan and plan super together."
        >
          <Chips options={WHO_OPTIONS} isOn={(v) => p.who === v} onPick={set("who")} />
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
          {journey.length} tools, in this order. Every other tool stays one tap away.
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
            Set up my dashboard
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
