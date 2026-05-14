"use client";

import { CalendarRange } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type PeriodKind, useUIStore } from "@/lib/state/ui-store";

const OPTIONS: { value: PeriodKind; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "fortnight", label: "Fortnight" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "This year" },
  { value: "custom", label: "Custom…" },
];

export function PeriodSwitcher() {
  const period = useUIStore((s) => s.period);
  const setPeriod = useUIStore((s) => s.setPeriod);

  return (
    <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKind)}>
      <SelectTrigger className="h-9 w-[170px] bg-surface/60">
        <CalendarRange className="mr-1 h-4 w-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
