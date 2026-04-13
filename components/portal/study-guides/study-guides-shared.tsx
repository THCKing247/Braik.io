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

/** Coach assignment cards — stable height to limit layout shift while data loads. */
export function StudyGuideAssignmentListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading assignments">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-[#E5E7EB]">
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-[58%] max-w-xs animate-pulse rounded bg-[#E2E8F0]" />
                <div className="h-3 w-[72%] max-w-md animate-pulse rounded bg-[#F1F5F9]" />
                <div className="h-3 w-[48%] max-w-sm animate-pulse rounded bg-[#F1F5F9]" />
              </div>
              <div className="h-6 w-24 shrink-0 animate-pulse rounded-md bg-[#F1F5F9]" />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="h-3 w-14 animate-pulse rounded bg-[#F1F5F9]" />
                <div className="h-3 w-32 animate-pulse rounded bg-[#F1F5F9]" />
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                <div className="h-full w-[35%] animate-pulse rounded-full bg-[#E2E8F0]" />
              </div>
              <div className="mt-1 h-3 w-40 animate-pulse rounded bg-[#F1F5F9]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function StudyGuideLibraryPackSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading study packs">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-[#E5E7EB]">
          <CardContent className="space-y-2 p-4">
            <div className="h-4 w-[40%] max-w-xs animate-pulse rounded bg-[#E2E8F0]" />
            <div className="h-3 w-full max-w-lg animate-pulse rounded bg-[#F1F5F9]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[#F1F5F9]" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function StudyGuideProgressSnapshotSkeleton() {
  return (
    <Card className="border-[#E5E7EB]" aria-busy="true" aria-label="Loading team snapshot">
      <CardContent className="flex flex-col gap-2 p-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded bg-[#F1F5F9]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-[#E2E8F0]" />
            <div className="h-3 w-full max-w-xl animate-pulse rounded bg-[#F1F5F9]" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** Player list rows — compact card shell. */
/** Assignment detail modal — stable block while fetching. */
export function StudyGuideDetailPaneSkeleton() {
  return (
    <div className="min-h-[220px] space-y-4 py-2" aria-busy="true" aria-label="Loading assignment">
      <div className="flex flex-wrap gap-2">
        <div className="h-6 w-28 animate-pulse rounded-md bg-[#F1F5F9]" />
        <div className="h-4 w-32 animate-pulse rounded bg-[#F1F5F9]" />
      </div>
      <div className="space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-[#E2E8F0]" />
        <div className="h-10 w-full animate-pulse rounded-md bg-[#F1F5F9]" />
        <div className="h-10 w-full animate-pulse rounded-md bg-[#F1F5F9]" />
        <div className="h-24 w-full animate-pulse rounded-md bg-[#F8FAFC]" />
      </div>
    </div>
  )
}

export function StudyGuidePlayerListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading assignments">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-[#E5E7EB]">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-[62%] max-w-sm animate-pulse rounded bg-[#E2E8F0]" />
                <div className="h-3 w-[55%] max-w-xs animate-pulse rounded bg-[#F1F5F9]" />
              </div>
              <div className="h-6 w-28 shrink-0 animate-pulse rounded-md bg-[#F1F5F9]" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
