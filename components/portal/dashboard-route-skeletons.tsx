import { cn } from "@/lib/utils"

/** Default main-area pulse used by most dashboard routes. */
export function DashboardMainSkeleton({
  className,
  "aria-label": ariaLabel = "Loading",
}: {
  className?: string
  "aria-label"?: string
}) {
  return (
    <div
      className={cn(
        "min-h-[50vh] w-full max-w-full animate-pulse rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm",
        className
      )}
      aria-busy="true"
      aria-label={ariaLabel}
    >
      <div className="h-7 w-48 rounded bg-[rgb(var(--platinum))]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-28 rounded-lg bg-[rgb(var(--platinum))]" />
        <div className="h-28 rounded-lg bg-[rgb(var(--platinum))]" />
        <div className="h-28 rounded-lg bg-[rgb(var(--platinum))]" />
      </div>
      <div className="mt-8 h-64 rounded-lg bg-[rgb(var(--platinum))]" />
    </div>
  )
}

export function DashboardMessagesSkeleton() {
  return (
    <div
      className="flex min-h-[50vh] w-full max-w-full gap-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm animate-pulse lg:gap-px"
      aria-busy="true"
      aria-label="Loading messages"
    >
      <div className="hidden w-72 shrink-0 flex-col border-r border-border lg:flex">
        <div className="h-14 border-b border-border bg-muted/40" />
        <div className="flex-1 space-y-2 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-[rgb(var(--platinum))]" />
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1 bg-muted/20 p-4">
        <div className="mx-auto max-w-lg space-y-3 pt-8">
          <div className="ml-auto h-10 w-[70%] rounded-2xl bg-[rgb(var(--platinum))]" />
          <div className="h-10 w-[65%] rounded-2xl bg-[rgb(var(--platinum))]" />
          <div className="ml-auto h-10 w-[55%] rounded-2xl bg-[rgb(var(--platinum))]" />
        </div>
      </div>
    </div>
  )
}

export function DashboardCalendarSkeleton() {
  return (
    <div className="min-h-[60vh] w-full animate-pulse space-y-4" aria-busy="true" aria-label="Loading calendar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-9 w-48 rounded-lg bg-[rgb(var(--platinum))]" />
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-[rgb(var(--platinum))]" />
          <div className="h-9 w-24 rounded-lg bg-[rgb(var(--platinum))]" />
        </div>
      </div>
      <div className="h-[min(70vh,520px)] rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-md bg-[rgb(var(--platinum))]" />
          ))}
        </div>
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
    <div className="min-h-[50vh] w-full animate-pulse space-y-4" aria-busy="true" aria-label="Loading schedule">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-8 w-56 rounded-lg bg-[rgb(var(--platinum))]" />
        <div className="flex gap-2">
          <div className="h-10 w-28 rounded-lg bg-[rgb(var(--platinum))]" />
          <div className="h-10 w-28 rounded-lg bg-[rgb(var(--platinum))]" />
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 w-full rounded-lg bg-[rgb(var(--platinum))]" />
        ))}
      </div>
    </div>
  )
}

export function DashboardStatsSkeleton() {
  return (
    <div className="min-h-[50vh] w-full animate-pulse space-y-6" aria-busy="true" aria-label="Loading stats">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-border bg-white shadow-sm">
            <div className="m-4 h-4 w-24 rounded bg-[rgb(var(--platinum))]" />
            <div className="mx-4 mt-2 h-8 w-16 rounded bg-[rgb(var(--platinum))]" />
          </div>
        ))}
      </div>
      <div className="h-12 w-full max-w-md rounded-lg bg-[rgb(var(--platinum))]" />
      <div className="min-h-[320px] rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="h-10 w-full rounded bg-[rgb(var(--platinum))]" />
        <div className="mt-4 space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 w-full rounded bg-[rgb(var(--platinum))]" />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Desktop roster: toolbar + grid placeholders while roster API resolves */
export function RosterDesktopSkeleton() {
  return (
    <div className="hidden w-full min-w-0 max-w-full space-y-4 lg:block" aria-busy="true" aria-label="Loading roster">
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-10 w-64 max-w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-10 w-24 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl border border-border bg-card shadow-sm" />
        ))}
      </div>
    </div>
  )
}

export function SettingsPageSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl animate-pulse space-y-6 p-6"
      aria-busy="true"
      aria-label="Loading settings"
    >
      <div className="h-8 w-40 rounded-md bg-muted" />
      <div className="h-32 w-full rounded-lg bg-muted" />
      <div className="h-48 w-full rounded-lg bg-muted" />
    </div>
  )
}
