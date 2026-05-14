"use client";

import { useMemo } from "react";
import { BarChart } from "@/components/charts/BarChart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MonthlyCashflow } from "../selectors";

interface Props {
  data: MonthlyCashflow[];
}

export function CashflowChart({ data }: Props) {
  const categories = useMemo(() => data.map((d) => d.month), [data]);
  const series = useMemo(
    () => [
      {
        name: "Income",
        data: data.map((d) => d.income),
        color: "hsl(152 65% 50%)",
      },
      {
        name: "Expense",
        data: data.map((d) => d.expense),
        color: "hsl(0 72% 60%)",
      },
    ],
    [data],
  );

  return (
    <Card className="border-border/60 bg-surface/70 backdrop-blur-md shadow-card">
      <CardHeader className="pb-0 pt-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
          Cashflow — 6 months
        </h2>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <BarChart series={series} categories={categories} height={200} />
      </CardContent>
    </Card>
  );
}
