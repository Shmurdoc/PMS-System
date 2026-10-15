import * as React from "react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string | number
  delta?: string
  deltaType?: "up" | "down" | "neutral"
  icon: React.ElementType
  className?: string
}

function StatCard({ label, value, delta, deltaType = "neutral", icon: Icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground relative overflow-hidden rounded-xl border p-4 shadow-xs transition-shadow duration-200 hover:shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
          {delta && (
            <p
              className={cn(
                "mt-1 text-xs",
                deltaType === "up" && "text-success",
                deltaType === "down" && "text-danger",
                deltaType === "neutral" && "text-muted-foreground"
              )}
            >
              {delta}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 rounded-lg bg-primary/10 p-2.5">
          <Icon className="size-4 text-primary" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

const MetricCard = StatCard

export { StatCard, MetricCard }
