"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  checked,
  onCheckedChange,
  ...props
}: Omit<CheckboxPrimitive.Root.Props, "onCheckedChange"> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean | "indeterminate") => void
}) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      onCheckedChange={onCheckedChange as CheckboxPrimitive.Root.Props["onCheckedChange"]}
      className={cn(
        "peer size-4 shrink-0 rounded border border-input bg-background transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[checked]:border-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-primary-foreground">
        <CheckIcon className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
