"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateRange } from "@/lib/date/periods";
import type { ViewCadence } from "../api/types";
import { formatPeriodLabel } from "../utils/period";

const VIEW_OPTIONS: { value: ViewCadence; label: string }[] = [
  { value: "weekly", label: "Week" },
  { value: "fortnightly", label: "Fortnight" },
  { value: "monthly", label: "Month" },
];

interface Props {
  viewCadence: ViewCadence;
  onViewCadenceChange: (cadence: ViewCadence) => void;
  periodRange: DateRange;
  periodOffset: number;
  onPeriodOffsetChange: (offset: number) => void;
}

export function BudgetPeriodNavigator({
  viewCadence,
  onViewCadenceChange,
  periodRange,
  periodOffset,
  onPeriodOffsetChange,
}: Props) {
  const label = formatPeriodLabel(periodRange, viewCadence);
  const canGoForward = periodOffset < 0;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Select value={viewCadence} onValueChange={(v) => onViewCadenceChange(v as ViewCadence)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {VIEW_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Previous period"
          onClick={() => onPeriodOffsetChange(periodOffset - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[10rem] text-center text-sm font-medium">{label}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Next period"
          disabled={!canGoForward}
          onClick={() => onPeriodOffsetChange(periodOffset + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
