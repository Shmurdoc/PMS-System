import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "gold"

const toneClasses: Record<StatusTone, string> = {
  success: "border-transparent bg-success/10 text-success [a&]:hover:bg-success/15",
  warning: "border-transparent bg-warning/10 text-warning [a&]:hover:bg-warning/15",
  danger: "border-transparent bg-danger/10 text-danger [a&]:hover:bg-danger/15",
  info: "border-transparent bg-info/10 text-info [a&]:hover:bg-info/15",
  neutral: "border-transparent bg-muted text-muted-foreground [a&]:hover:bg-muted/80",
  gold: "border-transparent bg-gold/10 text-gold [a&]:hover:bg-gold/15",
}

const STATUS_TONES: Record<string, StatusTone> = {
  available: "success",
  vacant: "success",
  free: "success",
  occupied: "info",
  blocked: "neutral",
  outoforder: "danger",
  "out-of-order": "danger",
  ooo: "danger",
  maintenance: "warning",
  dirty: "warning",
  cleaning: "warning",
  inspected: "success",
  confirmed: "success",
  "checked-in": "success",
  checkedin: "success",
  "checked-out": "neutral",
  checkedout: "neutral",
  "no-show": "danger",
  noshow: "danger",
  cancelled: "danger",
  canceled: "danger",
  pending: "warning",
  draft: "neutral",
  paid: "success",
  partial: "warning",
  unpaid: "danger",
  overdue: "danger",
  refunded: "neutral",
  active: "success",
  inactive: "neutral",
  paused: "warning",
  completed: "success",
  done: "success",
  resolved: "success",
  closed: "neutral",
  open: "info",
  inprogress: "info",
  "in-progress": "info",
  scheduled: "info",
  approved: "success",
  rejected: "danger",
  failed: "danger",
  error: "danger",
  healthy: "success",
  degraded: "warning",
  down: "danger",
  operational: "success",
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "neutral",
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s_]+/g, "-")
}

function detectTone(status: string): StatusTone {
  const key = normalizeStatus(status).replace(/-/g, "")
  const dashed = normalizeStatus(status)
  const direct = STATUS_TONES[dashed] ?? STATUS_TONES[key]
  if (direct) return direct
  if (/cancel|fail|error|overdue|declin|reject|critical|damag|breach|unpaid/.test(dashed)) return "danger"
  if (/pend|review|process|partial|wait|due|warn|maintenance|dirty|clean|schedul/.test(dashed)) return "warning"
  if (/paid|confirm|success|complete|approved|available|active|operational|healthy|done|inspected/.test(dashed)) return "success"
  if (/occup|assign|progress|open|info/.test(dashed)) return "info"
  return "neutral"
}

function formatLabel(status: string): string {
  return status
    .split(/[-_\s]+/)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
}

interface StatusBadgeProps extends Omit<React.ComponentProps<typeof Badge>, "variant"> {
  status: string
  label?: string
  tone?: StatusTone
  dot?: boolean
}

function StatusBadge({ status, label, tone, dot = true, className, children, ...props }: StatusBadgeProps) {
  const resolvedTone = tone ?? detectTone(status)
  return (
    <Badge
      className={cn("font-medium", toneClasses[resolvedTone], className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {children ?? label ?? formatLabel(status)}
    </Badge>
  )
}

export { StatusBadge, STATUS_TONES, detectTone }
export type { StatusTone }
