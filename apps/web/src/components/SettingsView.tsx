"use client";

import Link from "next/link";
import {
  answerLabels,
  Chips,
  DEBT_OPTIONS,
  EARN_OPTIONS,
  HOME_OPTIONS,
  LEASE_OPTIONS,
  type Option,
  toggleDebt,
  WHO_OPTIONS,
} from "@/components/answers";
import { ChevronIcon } from "@/components/Icons";
import { money } from "@/lib/format";
import type { Profile } from "@/lib/profile";
import type { SavedData } from "@/lib/saved";

const row = "flex min-h-15 items-center gap-3 px-4 py-2.5";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="mx-1 text-sm font-semibold text-muted">{title}</h2>
      <div className="overflow-hidden rounded-3xl bg-surface">{children}</div>
    </section>
  );
}

/** One answer: its current value, opening to the chips. Saves as you tap. */
function Answer<T extends string>(props: {
  title: string;
  value: string;
  options: Option<T>[];
  isOn: (v: T) => boolean;
  onPick: (v: T) => void;
}) {
  return (
    <details className="group border-t border-surface-container first:border-t-0">
      <summary
        className={`${row} cursor-pointer list-none hover:bg-surface-container [&::-webkit-details-marker]:hidden`}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-medium">{props.title}</span>
          <span className="text-[13px] text-muted">{props.value}</span>
        </span>
        <ChevronIcon className="shrink-0 text-muted transition group-open:rotate-90" />
      </summary>
      <div className="px-4 pt-1 pb-4">
        <Chips options={props.options} isOn={props.isOn} onPick={props.onPick} />
      </div>
    </details>
  );
}

export function SettingsView(props: {
  profile: Profile;
  data: SavedData;
  onChange: (p: Profile) => void;
  onRemember: () => void;
  onForget: () => void;
}) {
  const { profile: p, data } = props;
  const labels = answerLabels(p);
  const set =
    <K extends keyof Profile>(k: K) =>
    (v: Profile[K]) =>
      props.onChange({ ...p, [k]: v });
  // Names the tools have saved. Placeholder names are never shared, so these are real.
  const people = data.people.slice(0, p.who === "two" ? 2 : 1);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          Your answers shape your dashboard and plan. Changes save straight away.
        </p>
      </div>

      <Group title="Your situation">
        <Answer
          title="How you earn"
          value={labels.earn}
          options={EARN_OPTIONS}
          isOn={(v) => p.earn === v}
          onPick={set("earn")}
        />
        <Answer
          title="Home"
          value={labels.home}
          options={HOME_OPTIONS}
          isOn={(v) => p.home === v}
          onPick={set("home")}
        />
        <Answer
          title="Debts"
          value={labels.debts}
          options={DEBT_OPTIONS}
          isOn={(v) => (v === "none" ? p.debts.length === 0 : p.debts.includes(v))}
          onPick={(v) => props.onChange({ ...p, debts: toggleDebt(p.debts, v) })}
        />
        <Answer
          title="Novated lease"
          value={labels.lease}
          options={LEASE_OPTIONS}
          isOn={(v) => p.lease === v}
          onPick={set("lease")}
        />
        <Answer
          title="Planning for"
          value={labels.who}
          options={WHO_OPTIONS}
          isOn={(v) => p.who === v}
          onPick={set("who")}
        />
      </Group>

      <Group title="Household">
        {(people.length ? people : [{}]).map((person, i) => {
          const name = person.name ?? (i === 0 ? "You" : "Partner");
          const bits = [
            person.salary ? `${money(person.salary * 100)} a year` : "No salary saved yet",
            person.help ? "HELP" : null,
          ].filter(Boolean);
          return (
            <Link
              key={i}
              href="/pay/"
              className={`${row} border-t border-surface-container first:border-t-0 hover:bg-surface-container`}
            >
              <span
                aria-hidden="true"
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold ${
                  i === 0
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-tertiary-container text-on-tertiary-container"
                }`}
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-base font-medium">{name}</span>
                <span className="text-[13px] text-muted">{bits.join(", ")}</span>
              </span>
              <ChevronIcon className="shrink-0 text-muted" />
            </Link>
          );
        })}
      </Group>
      <p className="-mt-4 mx-1 text-[13px] text-muted">
        Names and salaries come from the pay calculator and carry into every tool.
      </p>

      <Group title="Your data">
        <div className={row}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-base font-medium">
              {data.remember ? "Remembered on this device" : "Not remembering your inputs"}
            </span>
            <span className="text-[13px] text-muted">
              Everything stays in this browser. Nothing is sent anywhere.
            </span>
          </span>
          {!data.remember && (
            <button
              type="button"
              onClick={props.onRemember}
              className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent hover:opacity-90"
            >
              Remember
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Forget your answers and every tool's inputs on this device?"))
              props.onForget();
          }}
          className={`${row} w-full border-t border-surface-container text-left text-base font-medium text-warn hover:bg-surface-container`}
        >
          Forget everything on this device
        </button>
      </Group>

      <p className="text-center text-xs text-muted">
        <Link href="/privacy/" className="text-accent hover:underline">
          Privacy
        </Link>{" "}
        · General information only, not financial advice.
      </p>
    </main>
  );
}
