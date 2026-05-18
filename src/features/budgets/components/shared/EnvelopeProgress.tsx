"use client";

import { cn } from "@/lib/utils";
import type { EnvelopeStatus } from "../../types";

const STATUS_BAR: Record<EnvelopeStatus, string> = {
  healthy: "bg-emerald-500/80",
  watch: "bg-amber-500/80",
  overspent: "bg-rose-500/80",
};

const STATUS_TRACK: Record<EnvelopeStatus, string> = {
  healthy: "bg-emerald-500/15",
  watch: "bg-amber-500/15",
  overspent: "bg-rose-500/15",
};

interface Props {
  /** 0..1 — values above 1 are clamped visually but the overflow flag is set. */
  ratio: number;
  status: EnvelopeStatus;
  className?: string;
  /** Show a thin background-coloured "rail" instead of plain bg-muted. */
  tintTrack?: boolean;
  height?: "thin" | "thick";
}

export function EnvelopeProgress({
  ratio,
  status,
  className,
  tintTrack = true,
  height = "thin",
}: Props) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full",
        height === "thin" ? "h-1.5" : "h-2.5",
        tintTrack ? STATUS_TRACK[status] : "bg-muted/40",
        className,
      )}
    >
      <div
        className={cn("h-full transition-[width]", STATUS_BAR[status])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}

export const STATUS_TEXT_COLOR: Record<EnvelopeStatus, string> = {
  healthy: "text-emerald-400",
  watch: "text-amber-400",
  overspent: "text-rose-400",
};

export const STATUS_BORDER_COLOR: Record<EnvelopeStatus, string> = {
  healthy: "border-emerald-500/40",
  watch: "border-amber-500/40",
  overspent: "border-rose-500/40",
};

export const STATUS_LABEL: Record<EnvelopeStatus, string> = {
  healthy: "On track",
  watch: "Watch",
  overspent: "Overspent",
};
