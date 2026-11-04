"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { buildJourney, type JourneyStep, parseProfile, planProgress } from "@/lib/profile";
import { readSaved, type ToolKey } from "@/lib/saved";
import { tool } from "@/lib/tools";

interface Place {
  steps: JourneyStep[];
  index: number;
  done: Set<ToolKey>;
}

/**
 * A thin bar at the top of a tool page when the tool is part of someone's
 * plan: which step it is, and the way back and on. Shows nothing otherwise.
 */
export function JourneyBar({ current }: { current: ToolKey }) {
  const [place, setPlace] = useState<Place | null>(null);

  useEffect(() => {
    const data = readSaved();
    const profile = parseProfile(data.profile);
    if (!profile) return;
    const steps = buildJourney(profile);
    const index = steps.findIndex((s) => s.key === current);
    if (index < 0) return;
    // This page saves its inputs as it opens, so count it as done.
    const { done } = planProgress(steps, { ...data.tools, [current]: "seen" });
    setPlace({ steps, index, done });
  }, [current]);

  if (!place) return null;
  const { steps, index, done } = place;
  const prev = steps[index - 1];
  const next = steps[index + 1];
  return (
    <nav aria-label="Your plan" className="bg-primary-container text-on-primary-container">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
        <Link href="/" className="text-sm font-semibold hover:underline">
          Your plan · step {index + 1} of {steps.length}
        </Link>
        <ol aria-hidden="true" className="flex min-w-0 flex-[1_1_200px] gap-1.5">
          {steps.map((s, i) => (
            <li
              key={s.key}
              className={`h-1.5 flex-1 rounded-full ${
                i === index ? "bg-accent" : done.has(s.key) ? "bg-good" : "bg-accent/20"
              }`}
            />
          ))}
        </ol>
        <div className="flex flex-wrap gap-x-4 text-sm">
          {prev && (
            <Link href={`${tool(prev.key).href}/`} className="text-accent hover:underline">
              Back: {tool(prev.key).name}
            </Link>
          )}
          {next ? (
            <Link
              href={`${tool(next.key).href}/`}
              className="font-semibold text-accent hover:underline"
            >
              Next: {tool(next.key).name}
            </Link>
          ) : (
            <Link href="/" className="font-semibold text-accent hover:underline">
              Back to my dashboard
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
