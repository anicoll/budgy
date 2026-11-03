"use client";

import type { ApexAxisChartSeries, ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { baseApexOptions, getChartTheme } from "./chart-theme";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Series {
  name: string;
  data: { x: string; y: number }[];
  color?: string;
}

interface Props {
  series: Series[];
  height?: number;
  gradient?: boolean;
  stacked?: boolean;
}

export function AreaChart({ series, height = 220, gradient = true, stacked = false }: Props) {
  const options = useMemo<ApexOptions>(() => {
    const theme = getChartTheme();
    const base = baseApexOptions(theme);
    return {
      ...base,
      chart: { ...base.chart, type: "area", stacked },
      stroke: { curve: "smooth", width: stacked ? 1 : 2 },
      fill: stacked
        ? { type: "solid", opacity: 0.8 }
        : gradient
          ? {
              type: "gradient",
              gradient: {
                shadeIntensity: 0.8,
                opacityFrom: 0.45,
                opacityTo: 0.02,
                stops: [0, 90, 100],
              },
            }
          : { type: "solid", opacity: 0.1 },
      colors: series.map((s) => s.color ?? theme.accentFrom),
      series: series.map((s) => ({ name: s.name, data: s.data })),
    };
  }, [series, gradient, stacked]);

  return (
    <ReactApexChart
      type="area"
      options={options}
      series={options.series as ApexAxisChartSeries}
      height={height}
    />
  );
}
