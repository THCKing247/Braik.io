"use client"

import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

/**
 * Root error boundary. Catches errors from layout.tsx in child segments
 * (e.g. dashboard layout), which are not caught by that segment's error.js
 * because the boundary is nested inside the layout.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[root] Server Components render error:", error.message, error.digest ?? "", error)
    try {
      const Sentry = (window as unknown as {
        Sentry?: { captureException: (err: unknown, ctx?: { extra?: Record<string, unknown> }) => void }
      }).Sentry
      if (Sentry?.captureException) {
        Sentry.captureException(error, { extra: { digest: error.digest } })
      }
    } catch (_) {
      // ignore
    }
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-[#f8fafc]">
      <Card className="w-full max-w-md border border-gray-200 bg-white text-center shadow-sm">
        <CardContent className="flex flex-col items-center gap-5 py-12 px-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <AlertCircle className="h-8 w-8 text-blue-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
            <p className="text-sm leading-relaxed text-gray-600">
              We couldn&apos;t load this page. This can happen due to a temporary connection or
              configuration issue. Try again or return to the dashboard.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-500">Reference: {error.digest}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={() => reset()} className="border-blue-600 text-blue-600">
              Try again
            </Button>
            <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/">Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
