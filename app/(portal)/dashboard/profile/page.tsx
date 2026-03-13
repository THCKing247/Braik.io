"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { User } from "lucide-react"

/**
 * My Profile: redirects players to their own roster profile when they have a claimed roster record.
 * If no team, DashboardPageShell shows ConnectToTeam. If no player record or error, shows clear empty/error state.
 */
export default function MyProfilePage() {
  return (
    <DashboardPageShell>
      {({ teamId, userId }) => (
        <MyProfileContent teamId={teamId} userId={userId} />
      )}
    </DashboardPageShell>
  )
}

function MyProfileContent({ teamId, userId }: { teamId: string; userId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "found" | "not_found" | "error">("loading")
  const replaceStarted = useRef(false)

  useEffect(() => {
    if (!teamId || !userId) {
      setStatus("not_found")
      return
    }
    let cancelled = false
    setStatus("loading")
    fetch(`/api/roster/me?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => {
        if (cancelled) return
        if (res.status === 403) {
          setStatus("not_found")
          return
        }
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then((data: { playerId: string | null; teamId: string } | void) => {
        if (cancelled || !data) return
        if (data.playerId && !replaceStarted.current) {
          replaceStarted.current = true
          setStatus("found")
          const url = `/dashboard/roster/${data.playerId}?teamId=${encodeURIComponent(data.teamId)}`
          router.replace(url)
        } else {
          setStatus("not_found")
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error")
      })
    return () => { cancelled = true }
  }, [teamId, userId, router])

  if (status === "loading" || status === "found") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
        {status === "found" && (
          <p className="text-sm text-[#64748B]">Opening your profile...</p>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-[rgb(var(--border))] bg-white p-8 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F5F9]">
          <User className="h-7 w-7 text-[#64748B]" />
        </div>
        <h2 className="text-xl font-semibold text-[#0F172A]">My Profile</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
          {status === "not_found"
            ? "You don't have a player profile on this team yet. Ask your coach to add you to the roster and send you an invite link to claim your profile. Once you've joined, you can view and update your info here."
            : "Something went wrong loading your profile. Please try again or go back to the dashboard."}
        </p>
        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href={teamId ? `/dashboard/roster?teamId=${encodeURIComponent(teamId)}` : "/dashboard/roster"} className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto">
              View Roster
            </Button>
          </Link>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="ghost" className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
