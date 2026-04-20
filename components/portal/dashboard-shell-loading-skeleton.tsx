import { LoadingState } from "@/components/ui/loading-state"

/** Immediate placeholder while GET /api/dashboard/shell runs after first paint. */
export function DashboardShellLoadingSkeleton() {
  return (
    <div className="app-shell dashboard-app-shell flex min-h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-border">
        <div className="h-14" aria-hidden />
      </header>
      <div className="flex flex-1 min-h-[50vh]">
        <div className="hidden w-64 shrink-0 lg:block" aria-hidden />
        <main className="flex-1 p-6">
          <LoadingState label="Loading dashboard" minHeightClassName="min-h-[40vh]" className="mx-auto max-w-3xl" size="lg" />
        </main>
      </div>
    </div>
  )
}
