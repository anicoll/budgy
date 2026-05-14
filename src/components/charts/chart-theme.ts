import type { ApexOptions } from "apexcharts";

function cssVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getChartTheme() {
  const foreground = cssVar("--foreground") || "210 20% 96%";
  const muted = cssVar("--muted-foreground") || "220 10% 65%";
  const border = cssVar("--border") || "222 25% 20%";
  const surface = cssVar("--surface-elevated") || "222 36% 13%";

  return {
    foreground: `hsl(${foreground})`,
    muted: `hsl(${muted})`,
    border: `hsl(${border})`,
    surface: `hsl(${surface})`,
    income: "hsl(152 65% 50%)",
    expense: "hsl(0 72% 60%)",
    accentFrom: "hsl(262 83% 65%)",
    accentTo: "hsl(190 95% 55%)",
  };
}

export function baseApexOptions(theme = getChartTheme()): ApexOptions {
  return {
    chart: {
      background: "transparent",
      toolbar: { show: false },
      zoom: { enabled: false },
      fontFamily: "var(--font-mono), ui-monospace, monospace",
      animations: {
        enabled: true,
        speed: 400,
        animateGradually: { enabled: true, delay: 50 },
        dynamicAnimation: { enabled: true, speed: 300 },
      },
    },
    theme: { mode: "dark" },
    grid: {
      borderColor: theme.border,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { colors: theme.muted, fontSize: "11px" },
      },
    },
    yaxis: {
      labels: {
        style: { colors: theme.muted, fontSize: "11px" },
        formatter: (v: number) => {
          if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
          if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
          return `$${v.toFixed(0)}`;
        },
      },
    },
    tooltip: {
      theme: "dark",
      style: { fontSize: "12px", fontFamily: "var(--font-sans)" },
      y: {
        formatter: (v: number) =>
          new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(v / 100),
      },
    },
    dataLabels: { enabled: false },
    legend: {
      show: true,
      labels: { colors: theme.muted },
      fontSize: "11px",
    },
    stroke: { curve: "smooth", width: 2 },
  };
}
