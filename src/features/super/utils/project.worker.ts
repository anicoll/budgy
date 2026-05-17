/// <reference lib="webworker" />

import type { Cents } from "@/lib/money/cents";
import { DEFAULT_SUPER_SETTINGS } from "../types";
import {
  computeDrawdown,
  computeMaxSustainableWithdrawal,
  computeRequiredContribution,
  projectSuper,
} from "./project";
import {
  FUND_COLORS,
  type FundProjectionResult,
  type SuperWorkerOutput,
  type WorkerMessage,
  type WorkerResponse,
} from "./project.worker-types";

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const {
    id,
    payload: { plans, settings, prefsSalary },
  } = e.data;

  const resolvedSettings = { ...DEFAULT_SUPER_SETTINGS, id: "primary", updatedAt: "", ...settings };

  // ── Per-fund projections ───────────────────────────────────────────────────

  const fundProjections: FundProjectionResult[] = plans.map((plan, i) => {
    const isIndependent = plan.ownerSalary !== undefined;
    const isPrimary = !isIndependent && plan.id === resolvedSettings.activePlanId;

    const effectiveSalary: Cents = isIndependent
      ? (plan.ownerSalary as Cents)
      : isPrimary
        ? (prefsSalary as Cents)
        : (0 as Cents);

    const effectiveCurrentAge = Number.isFinite(plan.ownerCurrentAge)
      ? (plan.ownerCurrentAge as number)
      : resolvedSettings.currentAge;
    const effectiveRetirementAge = Number.isFinite(plan.ownerRetirementAge)
      ? (plan.ownerRetirementAge as number)
      : resolvedSettings.retirementAge;
    const effectiveEmployerPct = isIndependent
      ? (plan.ownerEmployerPct ?? resolvedSettings.employerContributionPct)
      : isPrimary
        ? resolvedSettings.employerContributionPct
        : 0;

    return {
      plan,
      isIndependent,
      effectiveCurrentAge,
      projection: projectSuper({
        currentBalance: plan.currentBalance,
        annualSalary: effectiveSalary,
        employerContributionPct: effectiveEmployerPct,
        voluntaryContribution: plan.voluntaryContribution,
        voluntaryFrequency: plan.voluntaryFrequency,
        voluntaryType: plan.voluntaryType,
        expectedReturnPct: plan.expectedReturnPct,
        feesPct: plan.feesPct,
        inflationPct: resolvedSettings.inflationPct,
        currentAge: effectiveCurrentAge,
        retirementAge: effectiveRetirementAge,
      }),
      color: FUND_COLORS[i % FUND_COLORS.length],
    };
  });

  // ── Chart series (calendar year x-axis, flat line post-retirement) ─────────

  const calYear = new Date().getFullYear();
  const fundData = fundProjections.map((fp) => {
    const byYear = new Map<number, number>();
    for (const y of fp.projection.years) {
      byYear.set(calYear + (y.age - fp.effectiveCurrentAge), y.nominal as number);
    }
    return { fp, byYear };
  });

  const allYears = [...new Set(fundData.flatMap(({ byYear }) => [...byYear.keys()]))].sort(
    (a, b) => a - b,
  );

  const chartSeries = fundData.map(({ fp, byYear }) => {
    const retirementYear = byYear.size > 0 ? Math.max(...byYear.keys()) : calYear;
    const retirementBalance = fp.projection.retirementNominal as number;
    return {
      name: fp.plan.name,
      data: allYears.map((yr) => ({
        x: String(yr),
        y: byYear.get(yr) ?? (yr > retirementYear ? retirementBalance : 0),
      })),
      color: fp.color,
    };
  });

  // ── Aggregate totals ───────────────────────────────────────────────────────

  const totalNominal = fundProjections.reduce(
    (s, fp) => s + fp.projection.retirementNominal,
    0,
  ) as Cents;
  const totalReal = fundProjections.reduce((s, fp) => s + fp.projection.retirementReal, 0) as Cents;
  const totalDrawdown = fundProjections.reduce(
    (s, fp) => s + fp.projection.monthlyDrawdown,
    0,
  ) as Cents;
  const yearsToRetirement = Math.max(
    0,
    resolvedSettings.retirementAge - resolvedSettings.currentAge,
  );
  const hasMultipleOwners = fundProjections.some((fp) => fp.isIndependent);
  const capBreaches = fundProjections.filter(
    (fp) => fp.projection.concessionalCapBreached || fp.projection.nonConcessionalCapBreached,
  );

  // ── Drawdown phase ─────────────────────────────────────────────────────────

  let drawdownProjection = null;
  if (totalNominal > 0 && plans.length > 0) {
    const activeFund = plans.find((p) => p.id === resolvedSettings.activePlanId) ?? plans[0];
    if (activeFund) {
      drawdownProjection = computeDrawdown({
        retirementNominal: totalNominal,
        expectedReturnPct: activeFund.expectedReturnPct,
        inflationPct: resolvedSettings.inflationPct,
        retirementAge: resolvedSettings.retirementAge,
        monthlyDrawdownTarget: resolvedSettings.monthlyDrawdownTarget,
        yearsToRetirement,
      });
    }
  }

  const depletionAge = drawdownProjection?.depletionAge ?? null;
  const longevityColour =
    depletionAge === null
      ? "text-income"
      : depletionAge >= 90
        ? "text-warning"
        : "text-destructive";

  // ── Top-up contribution ────────────────────────────────────────────────────

  let topUpFortnightly: number | null = null;
  if (resolvedSettings.monthlyDrawdownTarget && drawdownProjection) {
    if (depletionAge === null) {
      topUpFortnightly = 0;
    } else {
      const activeFund = plans.find((p) => p.id === resolvedSettings.activePlanId) ?? plans[0];
      if (activeFund && yearsToRetirement > 0) {
        const realReturn = activeFund.expectedReturnPct - resolvedSettings.inflationPct;
        if (realReturn > 0) {
          const nominalMonthly = drawdownProjection.monthlyWithdrawal as number;
          const balanceNeeded = Math.round((nominalMonthly * 12) / realReturn);
          const gap = Math.max(0, balanceNeeded - totalNominal) as Cents;
          topUpFortnightly =
            gap === 0
              ? 0
              : (computeRequiredContribution(
                  gap,
                  activeFund.expectedReturnPct,
                  yearsToRetirement,
                ) as number);
        }
      }
    }
  }

  // ── Max sustainable withdrawal ─────────────────────────────────────────────

  let maxSustainableWithdrawal = 0;
  if (totalNominal > 0 && plans.length > 0) {
    const activeFund = plans.find((p) => p.id === resolvedSettings.activePlanId) ?? plans[0];
    if (activeFund) {
      maxSustainableWithdrawal = computeMaxSustainableWithdrawal({
        retirementNominal: totalNominal,
        expectedReturnPct: activeFund.expectedReturnPct,
        inflationPct: resolvedSettings.inflationPct,
        retirementAge: resolvedSettings.retirementAge,
        yearsToRetirement,
      }) as number;
    }
  }

  const response: WorkerResponse = {
    id,
    payload: {
      fundProjections,
      chartSeries,
      totalNominal,
      totalReal,
      totalDrawdown,
      yearsToRetirement,
      hasMultipleOwners,
      capBreaches,
      drawdownProjection,
      depletionAge,
      longevityColour,
      topUpFortnightly,
      maxSustainableWithdrawal,
    } satisfies SuperWorkerOutput,
  };

  self.postMessage(response);
};
