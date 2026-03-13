"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { Button } from "@/components/ui/button"
import Link from "next/link"

/**
 * My Profile: redirects players to their own roster profile when they have a claimed roster record.
 * If no team or no player record, shows connect-to-team or empty state.
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
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "found" | "not_found" | "error">("loading")

  useEffect(() => {
    if (!teamId || !userId) {
      setStatus("not_found")
      return
    }
    let cancelled = false
    setStatus("loading")
    fetch(`/api/roster/me?teamId=${encodeURIComponent(teamId)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load")
        return res.json()
      })
      .then((data: { playerId: string | null; teamId: string }) => {
        if (cancelled) return
        if (data.playerId) {
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

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  if (status === "found") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[rgb(var(--accent))] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md rounded-lg border border-[rgb(var(--border))] bg-white p-6 text-center">
      <h2 className="text-lg font-semibold text-[#0F172A]">My Profile</h2>
      <p className="mt-2 text-sm text-[#64748B]">
        {status === "not_found"
          ? "You don't have a player profile on this team yet. Ask your coach to add you to the roster and send you an invite to claim your profile."
          : "Something went wrong. Please try again."}
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link href={teamId ? `/dashboard/roster?teamId=${encodeURIComponent(teamId)}` : "/dashboard/roster"}>
          <Button variant="outline">View Roster</Button>
        </Link>
        <Link href="/dashboard">
          <Button variant="ghost">Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
