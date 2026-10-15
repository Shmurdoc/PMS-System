import * as React from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  subtitle?: React.ReactNode
  meta?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

function PageHeader({ title, subtitle, meta, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {meta && <div className="text-right text-xs text-muted-foreground">{meta}</div>}
        {actions}
      </div>
    </div>
  )
}

export { PageHeader }
