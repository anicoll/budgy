"use client";

import { TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { AnimatedNumber } from "@/components/money/AnimatedNumber";
import { Card, CardContent } from "@/components/ui/card";
import type { Cents } from "@/lib/money/cents";
import { formatPercent } from "@/lib/money/format";
import { cn } from "@/lib/utils";
import type { PeriodKpis } from "../selectors";

interface Props {
  kpis: PeriodKpis;
}

export function KpiCards({ kpis }: Props) {
  const cards = [
    {
      label: "Net worth",
      value: kpis.netWorth,
      icon: Wallet,
      gradient: true,
      format: "compact",
    },
    {
      label: "Period income",
      value: kpis.income,
      icon: TrendingUp,
      color: "text-income",
    },
    {
      label: "Period spend",
      value: kpis.expense,
      icon: TrendingDown,
      color: "text-expense",
    },
    {
      label: "Savings rate",
      value: null,
      rate: kpis.savingsRate,
      icon: null,
      color:
        kpis.savingsRate >= 0.2
          ? "text-income"
          : kpis.savingsRate >= 0.05
            ? "text-warning"
            : "text-expense",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.label}
            className="border-border/60 bg-surface/70 backdrop-blur-md shadow-card"
          >
            <CardContent className="flex flex-col gap-2 py-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {card.label}
                </span>
                {Icon && (
                  <Icon
                    className={cn(
                      "h-4 w-4 opacity-60",
                      "color" in card ? card.color : "text-muted-foreground",
                    )}
                  />
                )}
              </div>
              {"rate" in card && card.rate !== undefined ? (
                <span
                  className={cn(
                    "font-mono text-2xl font-semibold tabular-nums md:text-3xl",
                    card.color,
                  )}
                >
                  {formatPercent(card.rate)}
                </span>
              ) : card.value !== null ? (
                <AnimatedNumber
                  value={card.value as Cents}
                  compact={"format" in card && card.format === "compact"}
                  className={cn(
                    "text-2xl font-semibold md:text-3xl",
                    "gradient" in card && card.gradient
                      ? "text-gradient-accent"
                      : "color" in card
                        ? card.color
                        : "text-foreground",
                  )}
                />
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
