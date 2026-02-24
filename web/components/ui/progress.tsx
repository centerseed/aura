"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value))
    const barColor =
      clampedValue >= 100
        ? "bg-red-500"
        : clampedValue >= 60
          ? "bg-amber-500"
          : "bg-indigo-500"

    return (
      <div
        ref={ref}
        className={cn("relative w-full overflow-hidden rounded-full", className)}
        {...props}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", barColor)}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
