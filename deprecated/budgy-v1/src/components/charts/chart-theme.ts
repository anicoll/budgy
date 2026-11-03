import type { ApexOptions } from "apexcharts";

function isDarkMode(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

export function getChartTheme() {
  const dark = isDarkMode();
  return {
    isDark: dark,
    foreground: dark ? "hsl(210 20% 96%)" : "hsl(240 10% 15%)",
    muted: dark ? "hsl(220 10% 62%)" : "hsl(240 5% 42%)",
    border: dark ? "hsl(222 25% 22%)" : "hsl(240 5% 86%)",
    surface: dark ? "hsl(222 36% 13%)" : "hsl(0 0% 99%)",
    income: dark ? "hsl(152 65% 50%)" : "hsl(152 55% 35%)",
    expense: dark ? "hsl(0 72% 60%)" : "hsl(0 65% 50%)",
    accentFrom: dark ? "hsl(262 83% 65%)" : "hsl(262 70% 55%)",
    accentTo: dark ? "hsl(190 95% 55%)" : "hsl(190 75% 40%)",
  };
}

// All AreaChart series values are in CENTS. Both formatters divide by 100.
function fmtCentsYAxis(v: number): string {
  const d = v / 100;
  if (Math.abs(d) >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (Math.abs(d) >= 1_000) return `$${(d / 1_000).toFixed(0)}K`;
  return `$${d.toFixed(0)}`;
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
    theme: { mode: theme.isDark ? "dark" : "light" },
    grid: {
      borderColor: theme.border,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickAmount: 7,
      labels: {
        rotate: 0,
        style: { colors: theme.muted, fontSize: "11px" },
      },
    },
    yaxis: {
      labels: {
        style: { colors: theme.muted, fontSize: "11px" },
        formatter: fmtCentsYAxis,
      },
    },
    tooltip: {
      theme: theme.isDark ? "dark" : "light",
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
