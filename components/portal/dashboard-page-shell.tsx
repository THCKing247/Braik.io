"use client"

import { Suspense } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { useSearchParams } from "next/navigation"
import { ConnectToTeam } from "@/components/portal/connect-to-team"

/**
 * Internal component that uses useSearchParams - must be wrapped in Suspense
 */
function DashboardPageShellContent({
  children,
  requireTeam = true,
}: {
  children: (props: { teamId: string; userRole: string; userId: string; canEdit: boolean }) => React.ReactNode
  requireTeam?: boolean
}) {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const teamIdFromQuery = searchParams.get("teamId")
  const teamId = teamIdFromQuery || session?.user?.teamId || ""
  const userRole = session?.user?.role ?? "PLAYER"
  const userId = session?.user?.id ?? ""
  const canEdit = userRole === "HEAD_COACH" || userRole === "ASSISTANT_COACH"

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm" style={{ borderColor: "rgb(var(--border))" }}>
          <h2 className="text-base font-semibold" style={{ color: "rgb(var(--text))" }}>Session data is incomplete</h2>
          <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
            This can happen after a temporary connection issue. Refresh the page to try again, or sign out and back in if it persists.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md border px-3 py-2 text-sm font-medium"
            style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
          >
            Refresh page
          </button>
        </div>
      </div>
    )
  }

  if (requireTeam && !teamId) {
    return <ConnectToTeam role={userRole} />
  }

  return <>{children({ teamId, userRole, userId, canEdit })}</>
}

/**
 * Resolves teamId and session for dashboard child pages.
 * Shows loading or ConnectToTeam when needed; otherwise renders children with resolved props.
 * Wraps content in Suspense to handle useSearchParams() requirement.
 */
export function DashboardPageShell({
  children,
  requireTeam = true,
}: {
  children: (props: { teamId: string; userRole: string; userId: string; canEdit: boolean }) => React.ReactNode
  requireTeam?: boolean
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
        </div>
      }
    >
      <DashboardPageShellContent requireTeam={requireTeam}>
        {children}
      </DashboardPageShellContent>
    </Suspense>
  )
}
