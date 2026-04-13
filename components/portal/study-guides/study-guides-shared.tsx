import type { ComponentType } from "react"
import { Card, CardContent } from "@/components/ui/card"

export type CoachAssignmentSummary = {
  id: string
  title: string
  due_date: string | null
  assigned_to_type: string
  assigned_position_group?: string | null
  assigned_side?: string | null
  assignment_type?: string
  publish_status?: string
  counts: {
    notStarted: number
    inProgress: number
    completed: number
    overdue: number
    total: number
  }
  avgScore: number | null
}

export function assignmentTargetLabel(a: {
  assigned_to_type: string
  assigned_position_group?: string | null
  assigned_side?: string | null
}): string {
  if (a.assigned_to_type === "team") return "Entire Team"
  if (a.assigned_to_type === "side") {
    const s = a.assigned_side
    if (s === "offense") return "Offense"
    if (s === "defense") return "Defense"
    if (s === "special_teams") return "Special Teams"
    return "Side of ball"
  }
  if (a.assigned_to_type === "position_group") {
    const g = a.assigned_position_group?.trim()
    return g ? g : "Position group"
  }
  if (a.assigned_to_type === "players") return "Selected Players"
  return a.assigned_to_type
}

export function assignmentTypeLabel(t: string | undefined): string {
  if (t === "quiz") return "Quiz"
  if (t === "mixed") return "Mixed"
  return "Review"
}

export function completionPercent(counts: CoachAssignmentSummary["counts"]): number {
  if (counts.total <= 0) return 0
  return Math.round((counts.completed / counts.total) * 100)
}

export function progressBarClass(pct: number): string {
  if (pct >= 80) return "bg-green-500"
  if (pct >= 40) return "bg-amber-500"
  return "bg-slate-300"
}

export function DueDateBadge({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) {
    return (
      <span className="inline-flex items-center rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-2 py-0.5 text-xs font-medium text-[#64748B]">
        No due date
      </span>
    )
  }
  const d = new Date(dueDate)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((dueDay.getTime() - startToday.getTime()) / 86400000)

  if (diffDays < 0) {
    return (
      <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        Past due
      </span>
    )
  }
  if (diffDays <= 3) {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
        {diffDays === 0 ? "Due today" : diffDays === 1 ? "Due tomorrow" : `Due in ${diffDays} days`}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-2 py-0.5 text-xs font-medium text-[#64748B]">
      Due {d.toLocaleDateString()}
    </span>
  )
}

export function EmptyStateCard({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <Card className="border-[#E5E7EB]">
      <CardContent className="flex items-center gap-3 p-6 text-sm text-[#64748B]">
        <Icon className="h-8 w-8 shrink-0 text-[#94A3B8]" />
        {children}
      </CardContent>
    </Card>
  )
}
