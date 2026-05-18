"use client";

import { PiggyBank, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isoDateAU } from "@/lib/date/au-locale";
import { useCreateBudget } from "../hooks";

interface Props {
  onCreated: () => void;
}

/**
 * Shown when there is no active budget. Two paths:
 *   - "Get started" creates an empty monthly budget; user adds envelopes/categories one at a time.
 *   - "Skip" still creates the empty budget but jumps past the explainer (same end state).
 */
export function SetupWizard({ onCreated }: Props) {
  const createBudget = useCreateBudget();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await createBudget.mutateAsync({
        name: "My budget",
        period: "monthly",
        startDate: isoDateAU(),
        notes: "",
        targets: [],
      });
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Card className="border-violet-500/40 bg-gradient-to-br from-violet-500/10 via-surface/60 to-cyan-500/5 backdrop-blur-md">
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Welcome to envelopes</h1>
              <p className="text-xs text-muted-foreground">
                A friendlier way to think about your budget.
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Every category gets a virtual envelope. Each fortnight (or month) we top up the envelope
            by your target amount. When the bill arrives, the money is already set aside — no more
            &ldquo;over budget this month&rdquo; messages for predictable quarterly hits.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Tip
              title="Envelope mode"
              body="Best for lumpy bills — council rates, car rego, insurance. Balance carries across periods."
            />
            <Tip
              title="Period mode"
              body="Best for steady limits — groceries, fuel, eating out. Resets each period like a traditional budget."
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={start}
              disabled={busy}
              className="bg-gradient-accent text-primary-foreground hover:opacity-90"
            >
              <PiggyBank className="mr-1.5 h-3.5 w-3.5" />
              {busy ? "Creating…" : "Get started"}
            </Button>
            <span className="text-[11px] text-muted-foreground">
              You can change everything later in this page.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/60 p-3">
      <div className="text-xs font-medium">{title}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{body}</div>
    </div>
  );
}
