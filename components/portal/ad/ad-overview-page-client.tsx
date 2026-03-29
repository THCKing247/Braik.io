"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AdOverviewCards } from "@/components/portal/ad/ad-overview-cards"
import { AdLinkCodeGenerator } from "@/components/portal/ad/ad-link-code-generator"

type OverviewJson = {
  redirectTo?: string
  school: { name: string } | null
  department: { status: string | null } | null
  teamsCount: number
  athletesCount: number
  headCoachCount: number
  assistantCoachCount: number
  emptyStateTriggered: boolean
}

export function AdOverviewPageClient() {
  const router = useRouter()
  const [data, setData] = useState<OverviewJson | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/ad/pages/overview", { credentials: "include", cache: "no-store" })
        if (res.status === 401) {
          router.replace("/login?callbackUrl=/dashboard/ad")
          return
        }
        if (res.status === 403) {
          router.replace("/dashboard")
          return
        }
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as OverviewJson
        if (cancelled) return
        if (json.redirectTo) {
          router.replace(json.redirectTo)
          return
        }
        setData(json)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  if (error) {
    return <p className="text-[#212529]">Could not load overview.</p>
  }
  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded bg-[#E5E7EB]" />
        <div className="h-40 rounded-xl bg-[#F3F4F6]" />
      </div>
    )
  }

  const school = data.school
  const department = data.department
  const teamsCount = data.teamsCount
  const athletesCount = data.athletesCount
  const headCoachCount = data.headCoachCount
  const assistantCoachCount = data.assistantCoachCount
  const emptyStateTriggered = data.emptyStateTriggered

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#212529]">Department overview</h1>
        <p className="mt-1 text-[#6B7280]">
          {school?.name ? `${school.name} — Athletic Department` : "Your athletic department at a glance."}
        </p>
      </div>

      <AdOverviewCards
        totalTeams={teamsCount}
        totalAthletes={athletesCount}
        headCoachCount={headCoachCount}
        assistantCoachCount={assistantCoachCount}
        totalParents={0}
        planStatus={department?.status ?? "active"}
        departmentPlan="Athletic Department License"
      />

      {emptyStateTriggered && (
        <div className="rounded-xl border-2 border-[#3B82F6] bg-[#EFF6FF] p-6">
          <h2 className="text-lg font-semibold text-[#1E40AF]">No teams in view yet</h2>
          <p className="mt-2 text-sm text-[#1E3A8A]">
            Teams appear here from signup and provisioning. Open the Teams tab when programs are linked to your
            department. Use Coaches for staffing once teams appear; contact support if nothing shows up.
          </p>
          <Link
            href="/dashboard/ad/teams"
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#2563EB]"
          >
            View teams
          </Link>
        </div>
      )}

      <AdLinkCodeGenerator />

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#212529]">Recent activity</h2>
        <p className="mt-2 text-sm text-[#6B7280]">Activity feed will appear here as you add teams and coaches.</p>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#212529]">Billing & plan</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-[#F9FAFB] p-4">
          <div>
            <p className="font-medium text-[#212529]">Athletic Department License</p>
            <p className="text-2xl font-bold text-[#212529]">
              $6,500 <span className="text-sm font-normal text-[#6B7280]">/ year</span>
            </p>
            <p className="mt-1 text-sm text-[#6B7280]">Unlimited teams, athletes, and coaches</p>
          </div>
          <div className="rounded-md bg-[#D1FAE5] px-3 py-1 text-sm font-medium text-[#065F46]">
            Status: {department?.status ?? "active"}
          </div>
        </div>
        <p className="mt-4 text-sm text-[#6B7280]">
          Billing and renewal are managed through your account. Contact support to update payment or plan.
        </p>
      </div>
    </div>
  )
}
