"use client"

import Link from "next/link"

export function WeightRoomScaffold({ canEdit, userRole }: { canEdit: boolean; userRole: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Weight room</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Schedule, player maxes (including CSV import), leaderboard, and 1000 lb Club achievements are available to{" "}
          <strong>Head Coach</strong> and <strong>Assistant Coach</strong> accounts on this team.
        </p>
        <p className="mt-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--platinum))] px-3 py-2 text-sm text-[rgb(var(--text2))]">
          Signed in as <strong>{userRole.replace(/_/g, " ")}</strong>. The full weight room UI (maxes, CSV import, achievements,
          certificates) only appears for Head Coach and Assistant Coach. Use a coach account or ask an admin to change your team
          role. After a production deploy, hard-refresh (Ctrl+Shift+R) if you still see this screen as a coach.
        </p>
      </div>
      <div
        className="rounded-xl border border-border bg-card p-6 shadow-sm"
        style={{ borderColor: "rgb(var(--border))" }}
      >
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "If your role should include weight room access, confirm your assignment under team settings."
            : "Players and family members see strength updates elsewhere when coaches publish them."}
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
