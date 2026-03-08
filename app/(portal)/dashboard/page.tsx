"use client"

import { useSession } from "@/lib/auth/client-auth"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { ConnectToTeam } from "@/components/portal/connect-to-team"
import { TeamDashboard } from "@/components/portal/team-dashboard"

export const dynamic = "force-dynamic"

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const role = session?.user?.role
  const isHeadCoach = role === "HEAD_COACH"
  const hasTeam = Boolean(session?.user?.teamId)

  useEffect(() => {
    if (status === "authenticated" && role === "ATHLETIC_DIRECTOR") {
      router.replace("/dashboard/ad")
    }
  }, [status, role, router])

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
      </div>
    )
  }

  // Non-head-coach users who haven't entered a team code yet see the connect screen
  if (status === "authenticated" && !isHeadCoach && !hasTeam) {
    return <ConnectToTeam role={role || "PLAYER"} />
  }

  return <TeamDashboard session={session} />
}
