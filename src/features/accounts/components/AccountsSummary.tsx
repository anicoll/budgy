"use client";

import { Money } from "@/components/money/money";
import { Card, CardContent } from "@/components/ui/card";
import type { Cents } from "@/lib/money/cents";
import { cn } from "@/lib/utils";
import { type Account, isLiability } from "../types";

export function AccountsSummary({ accounts }: { accounts: Account[] }) {
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    if (a.archived) continue;
    if (isLiability(a.type)) liabilities += a.currentBalance;
    else assets += a.currentBalance;
  }
  const net = assets - liabilities;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Tile label="Net worth" value={net as Cents} variant="hero" />
      <Tile label="Assets" value={assets as Cents} variant="up" />
      <Tile label="Liabilities" value={liabilities as Cents} variant="down" />
    </div>
  );
}

function Tile({
  label,
  value,
  variant,
}: {
  label: string;
  value: Cents;
  variant: "hero" | "up" | "down";
}) {
  return (
    <Card className="border-border/60 bg-surface/70 backdrop-blur-md">
      <CardContent className="flex flex-col gap-1.5 py-5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <Money
          value={value}
          className={cn(
            "text-2xl font-semibold tracking-tight md:text-3xl",
            variant === "hero" && "text-gradient-accent",
            variant === "up" && "text-income",
            variant === "down" && "text-expense",
          )}
        />
      </CardContent>
    </Card>
  );
}
