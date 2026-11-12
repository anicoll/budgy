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
 * One row at the end of a tool page when the tool is part of someone's plan:
 * which step it is and the way on. Shows nothing otherwise.
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
  const next = steps.slice(index + 1).find((s) => !done.has(s.key)) ?? steps[index + 1];
  const left = steps.length - done.size;
  return (
    <nav aria-label="Your plan" className="mx-auto max-w-6xl px-4 pb-10 print:hidden">
      <Link
        href={next ? `${tool(next.key).href}/` : "/"}
        className="flex min-h-16 items-center justify-between gap-4 rounded-xl border border-border bg-surface px-4 py-3 hover:border-accent sm:px-5"
      >
        <span className="min-w-0">
          <strong className="block">
            {next ? `Next in your plan: ${tool(next.key).name}` : "That's your plan done"}
          </strong>
          <span className="text-sm text-muted">
            {next
              ? `${left > 0 ? `${left} of ${steps.length} left` : `Step ${index + 1} of ${steps.length}`}. Anything you've entered carries over.`
              : "Back to your dashboard"}
          </span>
        </span>
        <span aria-hidden="true" className="text-xl text-accent">
          ›
        </span>
      </Link>
    </nav>
  );
}
