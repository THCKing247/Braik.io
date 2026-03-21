"use client"

import Link from "next/link"

export function StudyGuidesScaffold({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Study guides</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Central place for install quizzes, terminology, and opponent prep. Football programs can grow this into shared team
          learning—starting as a structured foundation for coaches and players.
        </p>
      </div>
      <div
        className="rounded-xl border border-border bg-card p-6 shadow-sm"
        style={{ borderColor: "rgb(var(--border))" }}
      >
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "You'll publish guides and optional reading order for your roster here."
            : "Guides your coaches publish will appear here."}{" "}
          No content yet—tables and permissions are ready for the next implementation pass.
        </p>
        <p className="mt-4 text-xs text-muted-foreground">TODO: CRUD UI, assignments, and completion tracking.</p>
      </div>
      <p className="text-sm">
        <Link href="/dashboard" className="font-medium text-primary hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  )
}
