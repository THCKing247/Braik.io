"use client"

import { LucideIcon, Wrench } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

interface ComingSoonProps {
  title: string
  description?: string
  icon?: LucideIcon
}

export function ComingSoon({
  title,
  description,
  icon: Icon = Wrench,
}: ComingSoonProps) {
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
            <Icon className="h-8 w-8" style={{ color: "rgb(var(--accent))" }} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text))" }}>
              {title}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgb(var(--muted))" }}>
              {description ||
                "This feature is being built and will be available soon. Check back after launch."}
            </p>
          </div>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium"
            style={{
              borderColor: "rgb(var(--accent))",
              color: "rgb(var(--accent))",
              backgroundColor: "rgba(37,99,235,0.06)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            Coming Soon
          </span>
        </CardContent>
      </Card>
    </div>
  )
}

/** Shown on feature pages when the user has not yet connected to a team. */
export function TeamRequiredGate({ featureName }: { featureName: string }) {
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
            <Wrench className="h-8 w-8" style={{ color: "rgb(var(--muted))" }} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text))" }}>
              Connect to a Team First
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "rgb(var(--muted))" }}>
              You need to join a team before you can access <strong>{featureName}</strong>. Enter
              your Team Code on the dashboard to unlock all features.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgb(var(--accent))" }}
          >
            Go to Dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
