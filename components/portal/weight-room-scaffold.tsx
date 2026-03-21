"use client"

import Link from "next/link"

export function WeightRoomScaffold({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Weight room</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Program your lifts and progression by team. This area is under construction—schema and navigation are in place so we can
          connect trackers and templates in a later release.
        </p>
      </div>
      <div
        className="rounded-xl border border-border bg-card p-6 shadow-sm"
        style={{ borderColor: "rgb(var(--border))" }}
      >
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Coaches will manage weight-room templates here. Nothing to configure yet."
            : "Your coaches will publish weight-room content here when it is available."}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          TODO: Integrate sessions, max tracking, and roster visibility rules.
        </p>
      </div>
      <p className="text-sm">
        <Link href="/dashboard" className="font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  )
}
