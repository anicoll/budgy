"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border transition-all outline-none",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        "data-[size=default]:h-[20px] data-[size=default]:w-[36px]",
        "data-[size=sm]:h-[16px] data-[size=sm]:w-[28px]",
        // checked: violet fill, no border
        "data-[state=checked]:border-transparent data-[state=checked]:bg-primary",
        // unchecked: visible muted fill with a border for definition
        "data-[state=unchecked]:border-border/80 data-[state=unchecked]:bg-muted",
        "dark:data-[state=unchecked]:border-border dark:data-[state=unchecked]:bg-muted/60",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 transition-transform",
          // size
          "group-data-[size=default]/switch:size-4",
          "group-data-[size=sm]/switch:size-3",
          // thumb position
          "group-data-[size=default]/switch:data-[state=checked]:translate-x-[calc(100%-0px)]",
          "group-data-[size=sm]/switch:data-[state=checked]:translate-x-[calc(100%-0px)]",
          "group-data-[size=default]/switch:data-[state=unchecked]:translate-x-[2px]",
          "group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-[2px]",
          // thumb colour — always white when checked (on violet), muted-fg when unchecked
          "data-[state=checked]:bg-primary-foreground",
          "data-[state=unchecked]:bg-muted-foreground",
          "dark:data-[state=unchecked]:bg-foreground/70",
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
