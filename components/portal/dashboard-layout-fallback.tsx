import Link from "next/link"

/** Shown when the dashboard shell fails to load (client fetch error). */
export function DashboardLayoutFallback() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t load the dashboard. This can happen due to a temporary connection or configuration issue.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
