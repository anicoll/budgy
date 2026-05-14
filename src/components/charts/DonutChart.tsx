"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { baseApexOptions, getChartTheme } from "./chart-theme";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Slice {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  slices: Slice[];
  height?: number;
  showLegend?: boolean;
}

const PALETTE = [
  "#7c5cff",
  "#22c1c3",
  "#34d399",
  "#f5b942",
  "#fb7185",
  "#f97316",
  "#a78bfa",
  "#94a3b8",
];

export function DonutChart({ slices, height = 220, showLegend = true }: Props) {
  const options = useMemo<ApexOptions>(() => {
    const theme = getChartTheme();
    const base = baseApexOptions(theme);
    return {
      ...base,
      chart: { ...base.chart, type: "donut" },
      colors: slices.map((s, i) => s.color ?? PALETTE[i % PALETTE.length]),
      labels: slices.map((s) => s.label),
      series: slices.map((s) => s.value),
      plotOptions: {
        pie: {
          donut: {
            size: "68%",
            labels: {
              show: true,
              total: {
                show: true,
                label: "Total",
                color: theme.muted,
                fontSize: "11px",
                formatter: (w) => {
                  const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                  return new Intl.NumberFormat("en-AU", {
                    style: "currency",
                    currency: "AUD",
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(total / 100);
                },
              },
            },
          },
        },
      },
      stroke: { width: 2, colors: [theme.surface] },
      legend: {
        ...base.legend,
        show: showLegend,
        position: "bottom",
        offsetY: 4,
        itemMargin: { horizontal: 6, vertical: 2 },
        formatter: (
          label,
          opts?: { w: { globals: { series: number[] } }; seriesIndex: number },
        ) => {
          if (!opts) return label;
          const val = opts.w.globals.series[opts.seriesIndex];
          const formatted = new Intl.NumberFormat("en-AU", {
            style: "currency",
            currency: "AUD",
            notation: "compact",
            maximumFractionDigits: 1,
          }).format(val / 100);
          return `${label} — ${formatted}`;
        },
      },
      tooltip: {
        ...base.tooltip,
        y: {
          formatter: (v: number) =>
            new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v / 100),
        },
      },
    };
  }, [slices, showLegend]);

  return (
    <ReactApexChart
      type="donut"
      options={options}
      series={options.series as number[]}
      height={height}
    />
  );
}
