/** Immediate placeholder while GET /api/dashboard/shell runs after first paint. */
export function DashboardShellLoadingSkeleton() {
  return (
    <div className="app-shell flex min-h-screen flex-col bg-background">
      <header className="shrink-0 border-b border-border">
        <div className="h-14 animate-pulse bg-muted/40" aria-hidden />
      </header>
      <div className="flex flex-1 min-h-[50vh]">
        <div className="hidden w-64 shrink-0 animate-pulse bg-muted/30 lg:block" aria-hidden />
        <main className="flex-1 p-6">
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="h-8 w-48 animate-pulse rounded bg-muted/50" />
            <div className="h-4 w-full max-w-md animate-pulse rounded bg-muted/40" />
            <div className="h-40 w-full animate-pulse rounded-lg bg-muted/30" />
          </div>
        </main>
      </div>
    </div>
  )
}
