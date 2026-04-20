"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import Link from "next/link"
import { User } from "lucide-react"

/**
 * My Profile: redirects players to their own roster profile when they have a claimed roster record.
 * If no team, DashboardPageShell shows ConnectToTeam. If no player record or error, shows clear empty/error state.
 * When no linked player, shows "Claim Your Player Profile" card so the player can redeem an invite code.
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
  const [claimSuccess, setClaimSuccess] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [claimError, setClaimError] = useState<string | null>(null)
  const replaceStarted = useRef(false)

  const tryAutoLink = useCallback(async (): Promise<boolean> => {
    const res = await fetch("/api/player-invites/auto-link", {
      method: "POST",
      credentials: "same-origin",
    })
    const data = await res.json().catch(() => ({})) as { linked?: boolean; playerId?: string; teamId?: string }
    if (res.ok && data.linked && data.playerId && data.teamId) {
      router.replace(`/dashboard/roster/${data.playerId}?teamId=${encodeURIComponent(data.teamId)}`)
      return true
    }
    return false
  }, [router])

  useEffect(() => {
    if (!userId) {
      setStatus("not_found")
      return
    }
    let cancelled = false
    setStatus("loading")

    const run = async () => {
      if (teamId) {
        const res = await fetch(`/api/roster/me?teamId=${encodeURIComponent(teamId)}`)
        if (cancelled) return
        if (res.status === 403) {
          const linked = await tryAutoLink()
          if (cancelled) return
          if (!linked) setStatus("not_found")
          return
        }
        if (!res.ok) {
          setStatus("error")
          return
        }
        const data = (await res.json()) as { playerId: string | null; teamId: string }
        if (data.playerId && !replaceStarted.current) {
          replaceStarted.current = true
          setStatus("found")
          router.replace(`/dashboard/roster/${data.playerId}?teamId=${encodeURIComponent(data.teamId)}`)
          return
        }
      }
      const linked = await tryAutoLink()
      if (cancelled) return
      setStatus(linked ? "found" : "not_found")
    }
    run().catch(() => {
      if (!cancelled) setStatus("error")
    })
    return () => { cancelled = true }
  }, [teamId, userId, router, tryAutoLink])

  async function handleClaimSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClaimError(null)
    const code = inviteCode?.trim()
    if (!code) {
      setClaimError("Please enter an invite code.")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/invite/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setClaimError(data?.error ?? "Failed to redeem code. Please try again.")
        return
      }
      setClaimSuccess(true)
      setInviteCode("")
      const playerId = data.player_id
      const resolvedTeamId = data.team_id ?? teamId
      if (playerId && resolvedTeamId) {
        setTimeout(() => {
          router.replace(`/dashboard/roster/${playerId}?teamId=${encodeURIComponent(resolvedTeamId)}`)
        }, 1500)
      } else {
        router.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (status === "loading" || status === "found") {
    return (
      <div className="min-h-[50vh] px-4">
        <LoadingState
          label={status === "found" ? "Opening your profile" : "Loading profile"}
          minHeightClassName="min-h-[50vh]"
          size="lg"
        />
        {status === "found" ? <p className="text-center text-sm text-[#64748B]">Opening your profile...</p> : null}
      </div>
    )
  }

  const [checkingInvites, setCheckingInvites] = useState(false)
  const handleCheckInvites = async () => {
    setCheckingInvites(true)
    setClaimError(null)
    try {
      const linked = await tryAutoLink()
      if (!linked) setClaimError("No pending invite found for your email or phone.")
    } finally {
      setCheckingInvites(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {status === "not_found" && (
        <div className="rounded-xl border border-[rgb(var(--border))] bg-white p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-[#0F172A]">Claim Your Player Profile</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
            Enter the invite code your coach gave you to link your account to your roster spot, or use the options below.
          </p>
          {claimSuccess ? (
            <p className="mt-4 text-sm font-medium text-green-600">
              Profile successfully linked to team roster.
            </p>
          ) : (
            <form onSubmit={handleClaimSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="invite-code" className="sr-only">
                  Invite Code
                </label>
                <Input
                  id="invite-code"
                  type="text"
                  placeholder="Invite Code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full"
                  autoComplete="off"
                  disabled={submitting}
                />
              </div>
              {claimError && (
                <p className="text-sm text-red-600">{claimError}</p>
              )}
              <Button type="submit" className="w-full sm:w-auto" disabled={submitting}>
                {submitting ? "Joining..." : "Join Team"}
              </Button>
            </form>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[rgb(var(--border))] bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#F1F5F9]">
            <User className="h-7 w-7 text-[#64748B]" />
          </div>
          <h2 className="text-xl font-semibold text-[#0F172A]">My Profile</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
            {status === "not_found"
              ? "You do not have a linked player profile yet."
              : "Something went wrong loading your profile. Please try again or go back to the dashboard."}
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={checkingInvites}
              onClick={handleCheckInvites}
            >
              {checkingInvites ? "Checking…" : "Check for invites"}
            </Button>
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
    </div>
  )
}
