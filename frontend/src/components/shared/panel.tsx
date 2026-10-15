import * as React from "react"
import { cn } from "@/lib/utils"

interface PanelProps extends Omit<React.ComponentProps<"div">, "title"> {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  padded?: boolean
}

function Panel({ title, subtitle, action, children, className, padded = true, ...props }: PanelProps) {
  return (
    <section
      className={cn(
        "bg-card text-card-foreground flex flex-col overflow-hidden rounded-xl border shadow-xs",
        className
      )}
      {...props}
    >
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn(padded && "p-4")}>{children}</div>
    </section>
  )
}

export { Panel }
