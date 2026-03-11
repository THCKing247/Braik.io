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

  // Authenticated but missing user payload (e.g. session API returned incomplete data)
  if (status === "authenticated" && !session?.user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm" style={{ borderColor: "rgb(var(--border))" }}>
          <h2 className="text-base font-semibold" style={{ color: "rgb(var(--text))" }}>Session data is incomplete</h2>
          <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
            We could not finish loading your account details. Please refresh the page or sign out and back in.
          </p>
        </div>
      </div>
    )
  }

  return <TeamDashboard session={session} />
}
