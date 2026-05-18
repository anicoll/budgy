"use client";

import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/categories/hooks";
import { useTransactions } from "@/features/transactions/hooks";
import type { Transaction } from "@/features/transactions/types";
import { signedAmount } from "@/features/transactions/types";
import { useEnsureMissingTargets, useSetTarget } from "../hooks";
import { useBudgetComputeWorker } from "../hooks/useBudgetComputeWorker";
import type { Budget, EnvelopeState } from "../types";
import { defaultModeFor } from "../utils/envelope";
import { currentPeriodRange, formatPeriodLabel, shiftBudgetPeriod } from "../utils/period";
import { EnvelopeCard } from "./EnvelopeCard";
import { EnvelopeDetailSheet } from "./EnvelopeDetailSheet";
import { HousingSetupDialog, isHousingCategory } from "./HousingSetupDialog";
import { PeriodView } from "./PeriodView";
import { PlannerHeader, type PlannerViewMode } from "./PlannerHeader";

interface Props {
  budget: Budget;
}

export function BudgetPlannerView({ budget }: Props) {
  const { data: allCategories = [] } = useCategories({ includeArchived: false });
  const { data: transactions = [] } = useTransactions();
  const ensureMissingTargets = useEnsureMissingTargets();
  const setTarget = useSetTarget();

  const [viewMode, setViewMode] = useState<PlannerViewMode>("envelopes");
  const [viewPeriod, setViewPeriod] = useState(budget.period);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [openState, setOpenState] = useState<EnvelopeState | null>(null);
  const [housingDialogCat, setHousingDialogCat] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Period range for the current view + offset
  const viewRange = useMemo(() => {
    const base = currentPeriodRange(viewPeriod, budget.startDate);
    if (periodOffset === 0) return base;
    return shiftBudgetPeriod(viewPeriod, budget.startDate, base, periodOffset);
  }, [viewPeriod, budget.startDate, periodOffset]);

  const periodLabel = useMemo(
    () => formatPeriodLabel(viewRange, viewPeriod),
    [viewRange, viewPeriod],
  );

  // Compute payload for the worker — memoised so referential stability avoids needless recomputes
  const computeInput = useMemo(() => {
    if (allCategories.length === 0) return null;
    return {
      budget,
      transactions,
      categories: allCategories,
      nowISO: new Date().toISOString().slice(0, 10),
      viewRange,
      viewPeriod,
    };
  }, [budget, transactions, allCategories, viewRange, viewPeriod]);

  const { result, isComputing } = useBudgetComputeWorker(computeInput);
  const bundle = result?.bundle ?? null;

  // Auto-create empty targets for categories with spend but no row.
  // Deps intentionally narrow — we re-run when the worker output changes shape,
  // not on every transaction/category mutation (those flow through the worker first).
  // biome-ignore lint/correctness/useExhaustiveDependencies: narrow trigger by design
  useEffect(() => {
    if (!bundle || !transactions.length) return;
    const existing = new Set(budget.targets.map((t) => t.categoryId));
    const seen = new Set<string>();
    const missing: string[] = [];
    for (const t of transactions) {
      if (!t.categoryId || t.type === "transfer") continue;
      if (existing.has(t.categoryId)) continue;
      if (seen.has(t.categoryId)) continue;
      seen.add(t.categoryId);
      const cat = allCategories.find((c) => c.id === t.categoryId);
      if (!cat) continue;
      // Skip subcategories whose ancestor already has a target — they roll up
      let parent = cat.parentId;
      let coveredByAncestor = false;
      while (parent) {
        if (existing.has(parent)) {
          coveredByAncestor = true;
          break;
        }
        parent = allCategories.find((c) => c.id === parent)?.parentId ?? null;
      }
      if (coveredByAncestor) continue;
      missing.push(t.categoryId);
    }
    if (missing.length === 0) return;
    ensureMissingTargets.mutate({ budgetId: budget.id, categoryIds: missing });
  }, [bundle?.income.length, bundle?.expense.length]);

  const uncategorisedTxns = useMemo(
    () =>
      transactions.filter(
        (t) =>
          !t.categoryId &&
          t.type !== "transfer" &&
          t.date >= viewRange.from &&
          t.date <= viewRange.to,
      ),
    [transactions, viewRange],
  );

  const allocatedIds = useMemo(
    () => new Set(budget.targets.map((t) => t.categoryId)),
    [budget.targets],
  );
  const availableCategories = useMemo(
    () =>
      allCategories
        .filter((c) => c.type !== "transfer" && !c.archived && !allocatedIds.has(c.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allCategories, allocatedIds],
  );

  async function addCategory(categoryId: string) {
    const cat = allCategories.find((c) => c.id === categoryId);
    if (!cat) return;
    if (isHousingCategory(cat.name)) {
      setHousingDialogCat({ id: cat.id, name: cat.name, color: cat.color });
      setAddOpen(false);
      return;
    }
    const frequency = "monthly" as const;
    await setTarget.mutateAsync({
      budgetId: budget.id,
      categoryId,
      amount: 0,
      frequency,
      mode: defaultModeFor(frequency),
    });
    setAddOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <PlannerHeader
        budgetName={budget.name}
        viewMode={viewMode}
        onViewMode={setViewMode}
        viewPeriod={viewPeriod}
        onViewPeriod={(p) => {
          setViewPeriod(p);
          setPeriodOffset(0);
        }}
        periodOffset={periodOffset}
        onPeriodOffset={(d) => setPeriodOffset((prev) => prev + d)}
        periodLabel={periodLabel}
        bundle={bundle}
      />

      {bundle === null && isComputing && <LoadingGrid />}

      {bundle && viewMode === "envelopes" && (
        <EnvelopesView
          bundle={bundle}
          onOpen={setOpenState}
          onAddClick={() => setAddOpen((v) => !v)}
          addOpen={addOpen}
          availableCategories={availableCategories}
          onAddCategory={addCategory}
          uncategorisedTxns={uncategorisedTxns}
        />
      )}
      {bundle && viewMode === "period" && (
        <PeriodView bundle={bundle} onOpen={setOpenState} uncategorisedTxns={uncategorisedTxns} />
      )}

      <EnvelopeDetailSheet
        state={openState}
        budgetId={budget.id}
        transactions={transactions}
        onClose={() => setOpenState(null)}
      />

      {housingDialogCat && (
        <HousingSetupDialog
          category={housingDialogCat}
          budgetId={budget.id}
          onClose={() => setHousingDialogCat(null)}
        />
      )}
    </div>
  );
}

// ── Envelopes view (default) ─────────────────────────────────────────────────

function EnvelopesView({
  bundle,
  onOpen,
  onAddClick,
  addOpen,
  availableCategories,
  onAddCategory,
  uncategorisedTxns,
}: {
  bundle: import("../types").EnvelopeBundle;
  onOpen: (state: EnvelopeState) => void;
  onAddClick: () => void;
  addOpen: boolean;
  availableCategories: { id: string; name: string; color: string }[];
  onAddCategory: (id: string) => void;
  uncategorisedTxns: Transaction[];
}) {
  const sinkingFunds = [...bundle.income, ...bundle.expense].filter((r) => r.mode === "envelope");
  const periodRows = [...bundle.income, ...bundle.expense].filter((r) => r.mode === "period");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Sinking funds"
          subtitle="Money set aside for the next bill."
          rightSlot={
            <div className="relative">
              <Button size="sm" variant="outline" onClick={onAddClick} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add category
              </Button>
              {addOpen && availableCategories.length > 0 && (
                <AddDropdown
                  options={availableCategories}
                  onPick={onAddCategory}
                  onClose={onAddClick}
                />
              )}
              {addOpen && availableCategories.length === 0 && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border/60 bg-surface-elevated p-3 text-xs text-muted-foreground shadow-lg backdrop-blur-xl">
                  All categories are already added.
                </div>
              )}
            </div>
          }
        />
        {sinkingFunds.length === 0 ? (
          <EmptyHint
            title="No envelopes yet"
            body="Add a quarterly or yearly category — like council rates or insurance — to start setting money aside."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sinkingFunds.map((s) => (
              <EnvelopeCard key={s.categoryId} state={s} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Period budgets" subtitle="Steady weekly/monthly limits." />
        {periodRows.length === 0 ? (
          <EmptyHint
            title="No period categories yet"
            body="Add a weekly or monthly category — like groceries — to track period-level spending."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {periodRows.map((s) => (
              <EnvelopeCard key={s.categoryId} state={s} onOpen={onOpen} />
            ))}
          </div>
        )}
      </section>

      {uncategorisedTxns.length > 0 && <UncategorisedSection txns={uncategorisedTxns} />}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  rightSlot,
}: {
  title: string;
  subtitle: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">{subtitle}</p>
      </div>
      {rightSlot}
    </div>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-dashed border-border/60 bg-surface/30">
      <CardContent className="flex flex-col items-start gap-1 px-4 py-3">
        <div className="text-xs font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground">{body}</div>
      </CardContent>
    </Card>
  );
}

function AddDropdown({
  options,
  onPick,
  onClose,
}: {
  options: { id: string; name: string; color: string }[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div className="absolute right-0 top-full z-50 mt-1 max-h-[320px] w-[220px] overflow-y-auto overflow-hidden rounded-lg border border-border/60 bg-surface-elevated shadow-lg backdrop-blur-xl">
        {options.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: c.color }}
              aria-hidden
            />
            <span className="truncate">{c.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function UncategorisedSection({ txns }: { txns: Transaction[] }) {
  const [open, setOpen] = useState(false);
  const expense = txns.filter((t) => t.type === "debit");
  const income = txns.filter((t) => t.type === "credit");
  const totalExpense = expense.reduce((s, t) => s + Math.abs(signedAmount(t)), 0);
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <span className="flex-1 text-xs font-medium text-amber-300">
            Uncategorised this period
          </span>
          {totalExpense > 0 && (
            <Money value={totalExpense as never} className="text-xs text-rose-300 tabular-nums" />
          )}
          {totalIncome > 0 && (
            <Money value={totalIncome as never} className="text-xs text-emerald-300 tabular-nums" />
          )}
          <span className="text-[11px] text-muted-foreground">
            {txns.length} txn{txns.length !== 1 ? "s" : ""}
          </span>
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </button>
        {open && (
          <ul className="border-t border-amber-500/20 px-4 pb-3 pt-2 flex flex-col gap-1">
            {txns.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-1 text-xs">
                <span className="text-muted-foreground tabular-nums">{t.date}</span>
                <span className="flex-1 truncate">{t.payee || t.description || "—"}</span>
                <Money
                  value={signedAmount(t)}
                  variant="signed"
                  signColor
                  className="tabular-nums"
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {["a", "b", "c", "d"].map((k) => (
        <Skeleton key={k} className="h-32 rounded-2xl" />
      ))}
    </div>
  );
}
