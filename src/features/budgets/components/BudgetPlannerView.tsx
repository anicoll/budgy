"use client";

import { Plus, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Money } from "@/components/money/money";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCategories } from "@/features/categories/hooks";
import type { Cents } from "@/lib/money/cents";
import type { NovatedLease } from "@/lib/state/prefs-store";
import { usePrefs } from "@/lib/state/prefs-store";
import { cn } from "@/lib/utils";

// Stable empty array — prevents Zustand selector infinite loop when novatedLeases is undefined
const EMPTY_LEASES: NovatedLease[] = [];

import { useRemoveTarget, useSetBudgetViewPeriod, useSetTarget } from "../hooks";
import type { Budget, BudgetFrequency, BudgetPeriod, CategoryTarget, PlannerItem } from "../types";
import { BUDGET_PERIOD_LABEL } from "../types";
import { estimateFortnightlyNet } from "../utils/au-tax";
import { FREQUENCY_LABEL, normaliseToPeriod } from "../utils/normalise";
import { HousingSetupDialog, isHousingCategory } from "./HousingSetupDialog";

const PERIOD_TABS: { value: BudgetPeriod; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "fortnightly", label: "2 Week" },
  { value: "monthly", label: "Month" },
  { value: "yearly", label: "Year" },
];

// Smart default frequency for new targets
function defaultFrequency(type: "income" | "expense"): BudgetFrequency {
  return type === "income" ? "fortnightly" : "monthly";
}

function computePlannerItems(
  targets: CategoryTarget[],
  categoryMap: Map<string, { name: string; color: string; type: string; system?: boolean }>,
  viewPeriod: BudgetPeriod,
): { income: PlannerItem[]; expense: PlannerItem[]; totalIncome: Cents; totalExpense: Cents } {
  const income: PlannerItem[] = [];
  const expense: PlannerItem[] = [];

  for (const target of targets) {
    const cat = categoryMap.get(target.categoryId);
    if (!cat || cat.type === "transfer") continue;

    const normalisedAmount = normaliseToPeriod(
      target.amount,
      target.frequency,
      viewPeriod as BudgetFrequency,
    );

    const item: PlannerItem = {
      categoryId: target.categoryId,
      categoryName: cat.name,
      categoryColor: cat.color,
      categoryType: cat.type as "income" | "expense",
      categorySystem: cat.system,
      nativeAmount: target.amount,
      nativeFrequency: target.frequency,
      normalisedAmount,
    };

    if (cat.type === "income") income.push(item);
    else expense.push(item);
  }

  const totalIncome = income.reduce((s, i) => s + i.normalisedAmount, 0) as Cents;
  const totalExpense = expense.reduce((s, i) => s + i.normalisedAmount, 0) as Cents;

  return { income, expense, totalIncome, totalExpense };
}

interface Props {
  budget: Budget;
}

export function BudgetPlannerView({ budget }: Props) {
  const [viewPeriod, setViewPeriodLocal] = useState<BudgetPeriod>(budget.period);
  const [housingDialogCat, setHousingDialogCat] = useState<{
    id: string;
    name: string;
    color: string;
  } | null>(null);
  const setTargetMutation = useSetTarget();
  const removeTargetMutation = useRemoveTarget();
  const setPeriodMutation = useSetBudgetViewPeriod();
  const { data: allCategories = [], isPending: catsLoading } = useCategories();
  const annualSalary = usePrefs((s) => s.annualSalary);
  const hasPrivateHealth = usePrefs((s) => s.hasPrivateHealth ?? false);
  const novatedLeases = usePrefs((s) => s.novatedLeases ?? EMPTY_LEASES);

  const categoryMap = useMemo(
    () =>
      new Map(
        allCategories.map((c) => [
          c.id,
          { name: c.name, color: c.color, type: c.type, system: c.system },
        ]),
      ),
    [allCategories],
  );

  const { income, expense, totalIncome, totalExpense } = useMemo(
    () => computePlannerItems(budget.targets, categoryMap, viewPeriod),
    [budget.targets, categoryMap, viewPeriod],
  );

  const net = (totalIncome - totalExpense) as Cents;
  const allItems = [...income, ...expense];
  const allocatedIds = new Set(budget.targets.map((t) => t.categoryId));

  const availableIncome = allCategories.filter(
    (c) => c.type === "income" && !c.archived && !allocatedIds.has(c.id),
  );
  const availableExpense = allCategories.filter(
    (c) => c.type === "expense" && !c.archived && !allocatedIds.has(c.id),
  );

  function switchPeriod(next: BudgetPeriod) {
    if (next === viewPeriod) return;
    setViewPeriodLocal(next);
    setPeriodMutation.mutate({ id: budget.id, period: next });
  }

  function addCategory(categoryId: string, type: "income" | "expense") {
    const cat = allCategories.find((c) => c.id === categoryId);
    const catName = cat?.name ?? "";

    // Intercept housing/rent/mortgage — open smart dialog instead
    if (isHousingCategory(catName) && cat) {
      setHousingDialogCat({ id: cat.id, name: cat.name, color: cat.color });
      return;
    }

    // Smart salary default: pre-fill estimated net fortnightly (AU tax estimate)
    const isSalary = /salary/i.test(catName);
    const defaultAmount =
      isSalary && annualSalary && annualSalary > 0
        ? estimateFortnightlyNet(annualSalary, hasPrivateHealth, novatedLeases)
        : (0 as Cents);

    setTargetMutation.mutate({
      budgetId: budget.id,
      categoryId,
      amount: defaultAmount,
      frequency: isSalary ? "fortnightly" : defaultFrequency(type),
      rollover: false,
    });
  }

  function removeTarget(categoryId: string) {
    removeTargetMutation.mutate({ budgetId: budget.id, categoryId });
  }

  function saveTarget(categoryId: string, amount: number, frequency: BudgetFrequency) {
    setTargetMutation.mutate({
      budgetId: budget.id,
      categoryId,
      amount,
      frequency,
      rollover: false,
    });
  }

  const periodLabel = BUDGET_PERIOD_LABEL[viewPeriod].toLowerCase();

  return (
    <div className="flex flex-col gap-0">
      {/* Period tabs + total */}
      <div className="flex items-center justify-between border-b border-border/60 bg-surface/40 px-1 backdrop-blur-md">
        <div className="flex items-center">
          {PERIOD_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => switchPeriod(value)}
              className={cn(
                "px-4 py-3 text-sm font-medium transition-colors relative",
                viewPeriod === value
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              {viewPeriod === value && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-accent" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 pr-2 text-sm tabular-nums">
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Income{" "}
            </span>
            <Money value={totalIncome} className="font-semibold text-income" />
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Expenses{" "}
            </span>
            <Money value={totalExpense} className="font-semibold text-expense" />
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Net </span>
            <Money
              value={net}
              className={cn("font-semibold", net >= 0 ? "text-income" : "text-expense")}
            />
          </div>
        </div>
      </div>

      {/* Category strip */}
      {allItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-border/60 bg-surface/30 px-4 py-2.5 hide-scrollbar">
          {allItems.map((item) => (
            <div
              key={item.categoryId}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ background: item.categoryColor }}
            >
              <span>{item.categoryName}</span>
              <Money
                value={item.normalisedAmount}
                className="text-xs font-semibold text-white/90 tabular-nums"
              />
            </div>
          ))}
        </div>
      )}

      {/* Main planner */}
      <div className="flex flex-col gap-0 divide-y divide-border/30">
        {/* Income section */}
        <PlannerSection
          title="Income"
          items={income}
          viewPeriod={viewPeriod}
          periodLabel={periodLabel}
          available={availableIncome.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          onAdd={(id) => addCategory(id, "income")}
          onSave={saveTarget}
          onRemove={removeTarget}
          loading={catsLoading}
        />

        {/* Expense section */}
        <PlannerSection
          title="Expenses"
          items={expense}
          viewPeriod={viewPeriod}
          periodLabel={periodLabel}
          available={availableExpense.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          onAdd={(id) => addCategory(id, "expense")}
          onSave={saveTarget}
          onRemove={removeTarget}
          loading={catsLoading}
        />
      </div>

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

// ── PlannerSection ────────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  items: PlannerItem[];
  viewPeriod: BudgetPeriod;
  periodLabel: string;
  available: { id: string; name: string; color: string }[];
  onAdd: (categoryId: string) => void;
  onSave: (categoryId: string, amount: number, frequency: BudgetFrequency) => void;
  onRemove: (categoryId: string) => void;
  loading: boolean;
}

function PlannerSection({
  title,
  items,
  viewPeriod,
  periodLabel,
  available,
  onAdd,
  onSave,
  onRemove,
  loading,
}: SectionProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex flex-col">
      {/* Section header */}
      <div className="flex items-center justify-between bg-surface/50 px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddOpen(!addOpen)}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            aria-label={`Add ${title.toLowerCase()} category`}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
          {addOpen && (
            <AddCategoryDropdown
              available={available}
              onSelect={(id) => {
                onAdd(id);
                setAddOpen(false);
              }}
              onClose={() => setAddOpen(false)}
            />
          )}
        </div>
      </div>

      {/* Rows */}
      {loading ? (
        <div className="flex flex-col gap-0 px-4 py-2">
          {["a", "b"].map((k) => (
            <Skeleton key={k} className="mb-2 h-12 rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} categories yet — click Add to set one up.
        </div>
      ) : (
        <div className="divide-y divide-border/20">
          {items.map((item) => (
            <PlannerRow
              key={item.categoryId}
              item={item}
              viewPeriod={viewPeriod}
              periodLabel={periodLabel}
              onSave={onSave}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── PlannerRow ────────────────────────────────────────────────────────────

interface RowProps {
  item: PlannerItem;
  viewPeriod: BudgetPeriod;
  periodLabel: string;
  onSave: (categoryId: string, amount: number, frequency: BudgetFrequency) => void;
  onRemove: (categoryId: string) => void;
}

function PlannerRow({ item, viewPeriod, periodLabel, onSave, onRemove }: RowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rawAmount, setRawAmount] = useState(
    item.nativeAmount > 0 ? String(item.nativeAmount / 100) : "",
  );
  const [frequency, setFrequency] = useState<BudgetFrequency>(item.nativeFrequency);

  // Live preview: normalised for current view period
  const parsedCents = parseFloat(rawAmount) * 100;
  const preview =
    Number.isFinite(parsedCents) && parsedCents > 0
      ? normaliseToPeriod(
          Math.round(parsedCents) as Cents,
          frequency,
          viewPeriod as BudgetFrequency,
        )
      : null;

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(rawAmount);
    if (Number.isFinite(parsed) && parsed >= 0) {
      onSave(item.categoryId, Math.round(parsed * 100), frequency);
    }
  }, [rawAmount, frequency, item.categoryId, onSave]);

  const handleFrequencyChange = useCallback(
    (newFreq: BudgetFrequency) => {
      setFrequency(newFreq);
      const parsed = parseFloat(rawAmount);
      if (Number.isFinite(parsed) && parsed >= 0) {
        onSave(item.categoryId, Math.round(parsed * 100), newFreq);
      }
    },
    [rawAmount, item.categoryId, onSave],
  );

  const showNormalisedPreview = preview !== null && frequency !== viewPeriod;

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5">
      {/* Category avatar + name */}
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
        style={{ background: item.categoryColor }}
      >
        {item.categoryName.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.categoryName}</span>

      {/* Normalised preview (when frequency differs from view) */}
      {showNormalisedPreview && (
        <div className="hidden text-right sm:block">
          <div className="text-[10px] text-muted-foreground">/{periodLabel}</div>
          <Money value={preview} className="text-sm font-semibold tabular-nums" />
        </div>
      )}

      {/* Amount input */}
      <div className="relative w-28">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={rawAmount}
          onChange={(e) => setRawAmount(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.blur()}
          placeholder="0"
          className="w-full rounded-md border border-border/60 bg-surface/60 py-1.5 pl-6 pr-2 text-right text-sm tabular-nums transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          aria-label={`Amount for ${item.categoryName}`}
        />
      </div>

      {/* Frequency dropdown */}
      <Select value={frequency} onValueChange={(v) => handleFrequencyChange(v as BudgetFrequency)}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(FREQUENCY_LABEL) as BudgetFrequency[]).map((f) => (
            <SelectItem key={f} value={f} className="text-xs">
              {FREQUENCY_LABEL[f]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Remove — hidden for system categories */}
      {!item.categorySystem && (
        <button
          type="button"
          onClick={() => onRemove(item.categoryId)}
          aria-label={`Remove ${item.categoryName}`}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/40 opacity-0 transition-all hover:text-destructive group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {item.categorySystem && <div className="h-6 w-6 shrink-0" />}
    </div>
  );
}

// ── Add category dropdown ─────────────────────────────────────────────────

function AddCategoryDropdown({
  available,
  onSelect,
  onClose,
}: {
  available: { id: string; name: string; color: string }[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  if (available.length === 0) {
    return (
      <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border/60 bg-surface-elevated p-3 text-xs text-muted-foreground shadow-lg backdrop-blur-xl">
        All categories are already added.
      </div>
    );
  }

  return (
    <>
      {/* Click-outside overlay */}
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-border/60 bg-surface-elevated shadow-lg backdrop-blur-xl">
        {available.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: cat.color }} />
            {cat.name}
          </button>
        ))}
      </div>
    </>
  );
}
