"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronIcon, SearchIcon } from "@/components/Icons";
import { snapshot } from "@/lib/dashboard";
import { HOME_HREF } from "@/lib/nav";
import { buildJourney, type Profile } from "@/lib/profile";
import type { SavedData, ToolKey } from "@/lib/saved";
import { AREAS, TOOLS, type Tool, tool } from "@/lib/tools";

const matches = (t: Tool, q: string) =>
  !q || `${t.name} ${t.blurb}`.toLowerCase().includes(q.trim().toLowerCase());

function ToolRow({ t, note, filled }: { t: Tool; note: string; filled: boolean }) {
  return (
    <li className="border-t border-surface-container first:border-t-0">
      <Link
        href={`${t.href}/`}
        className="flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-surface-container"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-medium">{t.name}</span>
          <span className={`text-[13px] ${filled ? "text-text" : "text-muted"}`}>{note}</span>
        </span>
        <ChevronIcon className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="mx-1 text-sm font-semibold text-muted">{title}</h2>
      <ul className="overflow-hidden rounded-3xl bg-surface">{children}</ul>
    </section>
  );
}

/** Every tool, yours first with the number each one has saved. */
export function ToolsView({ profile, data }: { profile: Profile | null; data: SavedData }) {
  const [q, setQ] = useState("");
  const yours = useMemo(() => (profile ? buildJourney(profile).map((s) => s.key) : []), [profile]);
  const numbers = useMemo(() => {
    const m = new Map<ToolKey, string>();
    for (const t of snapshot(data)) m.set(t.key, `${t.value} · ${t.sub}`);
    return m;
  }, [data]);
  const note = (k: ToolKey) => numbers.get(k) ?? (data.tools[k] ? "Filled in" : tool(k).blurb);
  const mine = yours.map(tool).filter((t) => matches(t, q));
  const others = AREAS.map((a) => ({
    ...a,
    tools: TOOLS.filter((t) => t.area === a.area && !yours.includes(t.key) && matches(t, q)),
  })).filter((g) => g.tools.length);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6 pb-12 sm:px-6 sm:pt-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-4xl">Tools</h1>
        <label className="flex h-13 items-center gap-2.5 rounded-full bg-surface-container px-4 text-muted focus-within:outline-2 focus-within:outline-accent">
          <SearchIcon />
          <span className="sr-only">Search tools</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${TOOLS.length} tools`}
            className="min-w-0 flex-1 bg-transparent text-base text-text outline-none placeholder:text-muted"
          />
        </label>
      </div>

      {mine.length > 0 && (
        <Group title="Your tools">
          {mine.map((t) => (
            <ToolRow key={t.key} t={t} note={note(t.key)} filled={Boolean(data.tools[t.key])} />
          ))}
        </Group>
      )}
      {others.map((g) => (
        <Group key={g.area} title={g.name}>
          {g.tools.map((t) => (
            <ToolRow key={t.key} t={t} note={note(t.key)} filled={Boolean(data.tools[t.key])} />
          ))}
        </Group>
      ))}
      {!mine.length && !others.length && (
        <p className="text-[15px] text-muted">No tools match "{q}".</p>
      )}
      {!profile && (
        <p className="text-[15px] text-muted">
          Want these sorted for you?{" "}
          <Link href={HOME_HREF.settings} className="text-accent hover:underline">
            Answer five quick questions
          </Link>
          .
        </p>
      )}
    </main>
  );
}
