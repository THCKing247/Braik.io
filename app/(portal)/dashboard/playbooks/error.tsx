"use client"

import { useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { AlertCircle } from "lucide-react"

export default function PlaybooksError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[playbooks] Route error:", error.message, error.digest ?? "", error)
    if (typeof window !== "undefined" && (window as unknown as { Sentry?: { captureException: (err: unknown, ctx?: unknown) => void } }).Sentry?.captureException) {
      try {
        (window as unknown as { Sentry: { captureException: (err: unknown, ctx?: unknown) => void } }).Sentry.captureException(error, {
          extra: { digest: error.digest, route: "/dashboard/playbooks" },
        })
      } catch (_) {
        // ignore Sentry failures
      }
    }
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card
        className="w-full max-w-md border text-center"
        style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }}
      >
        <CardContent className="flex flex-col items-center gap-5 py-12 px-8">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgb(var(--platinum))" }}
          >
            <AlertCircle className="h-8 w-8" style={{ color: "rgb(var(--accent))" }} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text))" }}>
              Something went wrong
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgb(var(--muted))" }}>
              We couldn&apos;t load Playbooks. This can happen due to a temporary connection or
              configuration issue. Try again or return to the dashboard.
            </p>
            {error.digest && (
              <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                Reference: {error.digest}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => reset()}
              style={{ borderColor: "rgb(var(--accent))", color: "rgb(var(--accent))" }}
            >
              Try again
            </Button>
            <Button asChild style={{ backgroundColor: "rgb(var(--accent))" }}>
              <Link href="/dashboard">Back to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
