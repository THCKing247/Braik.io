import { cn } from "@/lib/utils"
import { LoadingState } from "@/components/ui/loading-state"

/** Default main-area pulse used by most dashboard routes. */
export function DashboardMainSkeleton({
  className,
  "aria-label": ariaLabel = "Loading",
}: {
  className?: string
  "aria-label"?: string
}) {
  return <LoadingState label={ariaLabel} className={cn("w-full max-w-full", className)} minHeightClassName="min-h-[50vh]" size="lg" />
}

export function DashboardMessagesSkeleton() {
  return <LoadingState label="Loading messages" className="w-full max-w-full" minHeightClassName="min-h-[50vh]" size="lg" />
}

export function DashboardCalendarSkeleton() {
  return <LoadingState label="Loading calendar" className="w-full" minHeightClassName="min-h-[60vh]" size="lg" />
}

/** Skeleton rows inside the schedule game card (shell stays visible). */
export function ScheduleGameListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-4 pb-4 md:px-0" aria-busy="true" aria-label="Loading games">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 w-full animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
      ))}
    </div>
  )
}

export function DashboardScheduleSkeleton() {
  return <LoadingState label="Loading schedule" className="w-full" minHeightClassName="min-h-[50vh]" size="lg" />
}

export function DashboardStatsSkeleton() {
  return <LoadingState label="Loading stats" className="w-full" minHeightClassName="min-h-[50vh]" size="lg" />
}

/** Desktop roster: toolbar + grid placeholders while roster API resolves */
export function RosterDesktopSkeleton() {
  return <LoadingState label="Loading roster" className="hidden w-full lg:flex" minHeightClassName="min-h-[50vh]" size="lg" />
}

export function SettingsPageSkeleton() {
  return <LoadingState label="Loading settings" className="mx-auto max-w-2xl p-6" minHeightClassName="min-h-[40vh]" size="lg" />
}
