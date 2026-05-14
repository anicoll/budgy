"use client";

import { DonutChart } from "@/components/charts/DonutChart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CategorySpend } from "../selectors";

interface Props {
  data: CategorySpend[];
  periodLabel: string;
}

export function CategorySpendDonut({ data, periodLabel }: Props) {
  if (data.length === 0) {
    return (
      <Card className="border-border/60 bg-surface/70 backdrop-blur-md shadow-card">
        <CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          No expenses this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-surface/70 backdrop-blur-md shadow-card">
      <CardHeader className="pb-0 pt-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
          Spend by category — {periodLabel}
        </h2>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <DonutChart slices={data} height={280} showLegend />
      </CardContent>
    </Card>
  );
}
