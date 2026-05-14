"use client";

import { motion, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";
import type { Cents } from "@/lib/money/cents";
import { formatAUD, formatAUDCompact } from "@/lib/money/format";
import { cn } from "@/lib/utils";

interface Props {
  value: Cents;
  compact?: boolean;
  className?: string;
}

export function AnimatedNumber({ value, compact = false, className }: Props) {
  const spring = useSpring(value, { stiffness: 80, damping: 20, mass: 0.8 });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  const display = useTransform(spring, (v) =>
    compact ? formatAUDCompact(Math.round(v) as Cents) : formatAUD(Math.round(v) as Cents),
  );

  return <motion.span className={cn("font-mono tabular-nums", className)}>{display}</motion.span>;
}
