import { cn } from "@/lib/utils"
import { LoadingState } from "@/components/ui/loading-state"

/**
 * TECH_DEBT: Large `min-h-[50vh]+` skeletons here are for **in-route** loading. Do not use them as a second
 * full-page gate when shell/bootstrap identity is already available (TECH_DEBT_GUARDRAILS.md §2; PERFORMANCE_GUIDELINES §C).
 */

/** Compact pulse for route segments while dashboard chrome (nav/sidebar) is already mounted — avoids a second full-viewport loading beat. */
export function DashboardRouteTransitionPulse({
  className,
  "aria-label": ariaLabel = "Loading",
}: {
  className?: string
  "aria-label"?: string
}) {
  return (
    <div
      className={cn("w-full max-w-full space-y-3 px-4 pb-4 pt-2 md:px-6", className)}
      aria-busy
      aria-label={ariaLabel}
    >
      <div className="h-8 w-2/3 max-w-md animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
      <div className="h-36 w-full animate-pulse rounded-xl bg-[rgb(var(--platinum))]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-28 animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
        <div className="h-28 animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
      </div>
    </div>
  )
}

/** Default main-area pulse used by most dashboard routes (legacy — prefer {@link DashboardRouteTransitionPulse} when shell is already visible). */
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
  return (
    <div className="w-full space-y-3 px-4 pb-4 pt-2 md:px-6" aria-busy aria-label="Loading messages">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-14 w-full animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
      ))}
    </div>
  )
}

export function DashboardCalendarSkeleton() {
  return (
    <div className="w-full px-4 pb-4 pt-2 md:px-6" aria-busy aria-label="Loading calendar">
      <div className="mb-4 h-10 max-w-md animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: 28 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-md bg-[rgb(var(--platinum))]" />
        ))}
      </div>
    </div>
  )
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
  return (
    <div className="w-full px-4 pb-4 pt-2 md:px-6">
      <div className="mb-4 h-9 max-w-xs animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
      <ScheduleGameListSkeleton rows={8} />
    </div>
  )
}

export function DashboardStatsSkeleton() {
  return (
    <div className="w-full space-y-4 px-4 pb-4 pt-2 md:px-6" aria-busy aria-label="Loading stats">
      <div className="h-10 max-w-sm animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-[rgb(var(--platinum))]" />
      ))}
    </div>
  )
}

/** Desktop roster: toolbar + grid placeholders while roster API resolves */
export function RosterDesktopSkeleton() {
  return <LoadingState label="Loading roster" className="hidden w-full lg:flex" minHeightClassName="min-h-[50vh]" size="lg" />
}

/** Roster route segment — toolbar + row pulses (all breakpoints; shell chrome already visible). */
export function RosterRouteSkeleton() {
  return (
    <div className="w-full px-4 pb-4 pt-2 md:px-6" aria-busy aria-label="Loading roster">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="h-10 w-full max-w-xs animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
        <div className="h-10 w-full max-w-[220px] animate-pulse rounded-lg bg-[rgb(var(--platinum))]" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-md bg-[rgb(var(--platinum))]" />
        ))}
      </div>
    </div>
  )
}

export function SettingsPageSkeleton() {
  return <LoadingState label="Loading settings" className="mx-auto max-w-2xl p-6" minHeightClassName="min-h-[40vh]" size="lg" />
}
