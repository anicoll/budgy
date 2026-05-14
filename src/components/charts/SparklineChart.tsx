"use client";

import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  data: number[];
  color?: string;
  positive?: boolean;
  height?: number;
}

export function SparklineChart({ data, color, positive = true, height = 40 }: Props) {
  const resolvedColor = color ?? (positive ? "hsl(152 65% 50%)" : "hsl(0 72% 60%)");

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "line",
        sparkline: { enabled: true },
        animations: { enabled: false },
        background: "transparent",
      },
      stroke: { curve: "smooth", width: 2 },
      colors: [resolvedColor],
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.3,
          opacityTo: 0,
          stops: [0, 100],
        },
      },
      tooltip: { enabled: false },
      xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
      yaxis: { show: false },
    }),
    [resolvedColor],
  );

  return (
    <ReactApexChart
      type="line"
      options={options}
      series={[{ data }]}
      height={height}
      width="100%"
    />
  );
}
