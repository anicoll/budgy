import type { Cents } from "@/lib/money/cents";
import { formatAUD, formatAUDCompact, formatSigned } from "@/lib/money/format";
import { cn } from "@/lib/utils";

interface MoneyProps {
  value: Cents;
  variant?: "default" | "signed" | "compact";
  className?: string;
  signColor?: boolean;
  muted?: boolean;
}

export function Money({
  value,
  variant = "default",
  className,
  signColor = false,
  muted = false,
}: MoneyProps) {
  const text =
    variant === "signed"
      ? formatSigned(value)
      : variant === "compact"
        ? formatAUDCompact(value)
        : formatAUD(value);

  const colorClass = signColor
    ? value > 0
      ? "text-income"
      : value < 0
        ? "text-expense"
        : undefined
    : undefined;

  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        muted && "text-muted-foreground",
        colorClass,
        className,
      )}
    >
      {text}
    </span>
  );
}
