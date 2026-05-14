"use client";

import type { ApexAxisChartSeries, ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { baseApexOptions, getChartTheme } from "./chart-theme";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Series {
  name: string;
  data: number[];
  color?: string;
}

interface Props {
  series: Series[];
  categories: string[];
  height?: number;
  stacked?: boolean;
}

export function BarChart({ series, categories, height = 200, stacked = false }: Props) {
  const options = useMemo<ApexOptions>(() => {
    const theme = getChartTheme();
    const base = baseApexOptions(theme);
    return {
      ...base,
      chart: { ...base.chart, type: "bar", stacked },
      plotOptions: {
        bar: {
          columnWidth: "55%",
          borderRadius: 4,
          borderRadiusApplication: "end",
        },
      },
      xaxis: {
        ...base.xaxis,
        categories,
      },
      colors: series.map((s, i) => s.color ?? (i === 0 ? theme.income : theme.expense)),
      series: series.map((s) => ({ name: s.name, data: s.data })),
    };
  }, [series, categories, stacked]);

  return (
    <ReactApexChart
      type="bar"
      options={options}
      series={options.series as ApexAxisChartSeries}
      height={height}
    />
  );
}
