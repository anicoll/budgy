"use client";

import { useMemo } from "react";
import { AreaChart } from "@/components/charts/AreaChart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { MonthlyNetWorth } from "../selectors";

interface Props {
  data: MonthlyNetWorth[];
}

export function NetWorthChart({ data }: Props) {
  const series = useMemo(
    () => [
      {
        name: "Net worth",
        data: data.map((d) => ({ x: d.month, y: d.netWorth })),
        color: "hsl(262 83% 65%)",
      },
    ],
    [data],
  );

  return (
    <Card className="border-border/60 bg-surface/70 backdrop-blur-md shadow-card">
      <CardHeader className="pb-0 pt-4">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
          Net worth — 12 months
        </h2>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        <AreaChart series={series} height={200} gradient />
      </CardContent>
    </Card>
  );
}
