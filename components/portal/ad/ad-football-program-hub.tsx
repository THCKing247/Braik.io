"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { devDashboardHandoffLog } from "@/lib/debug/dashboard-handoff-dev"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoadingState } from "@/components/ui/loading-state"
import { buildDashboardTeamPath } from "@/lib/navigation/organization-routes"

type HubTeam = { id: string; name: string; teamLevel: string }
type StaffRow = {
  id: string
  name: string
  email: string
  teamId: string | null
  teamName: string | null
  teamLevel: string | null
  staffStatus: string | null
}
type AssignmentRow = { assignmentType: string; userId: string; displayName: string | null }

type HubPayload = {
  eligible: boolean
  programId: string | null
  programName: string | null
  programRole: string | null
  teams: HubTeam[]
  coachAssignments: AssignmentRow[]
  staff: StaffRow[]
  shortOrgId: string | null
  teamShortIds: Record<string, string> | null
}

const LEVEL_LABEL: Record<string, string> = {
  varsity: "Varsity",
  jv: "JV",
  freshman: "Freshman",
}

function defaultVarsityTeamId(teams: HubTeam[]): string | null {
  const varsity = teams.find((t) => t.teamLevel === "varsity")
  return (varsity ?? teams[0])?.id ?? null
}

/** Football program controls inside the organization portal. */
export function AdFootballProgramHub() {
  const router = useRouter()
  const params = useParams<{ shortOrgId?: string }>()
  const orgBase = params?.shortOrgId ? `/org/${params.shortOrgId}` : null
  const [data, setData] = useState<HubPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/me/director-hub")
    const json = (await res.json()) as HubPayload
    if (!json.eligible) {
      router.replace(orgBase ? `${orgBase}/coaches` : "/dashboard/ad/coaches")
      return
    }
    setData(json)
    setLoading(false)
  }, [router, orgBase])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!data?.teams?.length) return
    setSelectedTeamId((prev) => {
      if (prev && data.teams.some((t) => t.id === prev)) return prev
      return defaultVarsityTeamId(data.teams)
    })
  }, [data?.teams])

  useEffect(() => {
    if (!selectedTeamId) return
    const selectedShortId = data?.teamShortIds?.[selectedTeamId]
    const canonicalPath =
      selectedShortId && data?.shortOrgId
        ? buildDashboardTeamPath({
            shortOrgId: data.shortOrgId,
            shortTeamId: selectedShortId,
          })
        : `/dashboard?teamId=${encodeURIComponent(selectedTeamId)}`
    devDashboardHandoffLog("AdFootballProgramHub", {
      selectedTeamId,
      portalHref: canonicalPath,
    })
  }, [selectedTeamId, data?.teamShortIds, data?.shortOrgId])

  const assignStaffTeam = async (userId: string, teamId: string) => {
    if (!data?.programId) return
    setSaving(userId)
    try {
      const res = await fetch(`/api/programs/${data.programId}/staff/${userId}/team`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      })
      if (res.ok) await load()
      else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Could not move coach")
      }
    } finally {
      setSaving(null)
    }
  }

  const assignHead = async (assignmentType: "jv_head" | "freshman_head", userId: string | null) => {
    if (!data?.programId) return
    setSaving(`head-${assignmentType}`)
    try {
      const res = await fetch(`/api/programs/${data.programId}/coach-assignments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentType, userId }),
      })
      if (res.ok) await load()
      else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Could not update head coach role")
      }
    } finally {
      setSaving(null)
    }
  }

  if (loading || !data) {
    return <LoadingState label="Loading program hub" minHeightClassName="min-h-[50vh]" size="lg" />
  }

  const assignmentOptions = data.staff.filter((s) => s.staffStatus !== "pending_assignment")
  const jvHeadId = data.coachAssignments.find((a) => a.assignmentType === "jv_head")?.userId ?? ""
  const frHeadId = data.coachAssignments.find((a) => a.assignmentType === "freshman_head")?.userId ?? ""
  const selectedTeam = data.teams.find((t) => t.id === selectedTeamId) ?? null
  const selectedLevelLabel = selectedTeam ? LEVEL_LABEL[selectedTeam.teamLevel] || selectedTeam.teamLevel : ""
  const selectedTeamShortId = selectedTeamId ? data.teamShortIds?.[selectedTeamId] : null
  const selectedTeamPortalHref =
    selectedTeamId && selectedTeamShortId && data.shortOrgId
      ? buildDashboardTeamPath({
          shortOrgId: data.shortOrgId,
          shortTeamId: selectedTeamShortId,
        })
      : selectedTeamId
        ? `/dashboard?teamId=${encodeURIComponent(selectedTeamId)}`
        : "/dashboard"

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Football program (organization portal)
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {data.programName || "Your program"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a team portal to work in, place assistants on Varsity / JV / Freshman, and set JV and Freshman head
          coaches. Coaching titles (coordinator, position coach) are still assigned in each team&apos;s Settings → Users
          after a coach is on the right team.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team context</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Select Varsity, JV, or Freshman, then open that team&apos;s portal. Coaching titles (OC / DC / position) are
            still set per team in Settings → Users after staff are on the right team.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Program team level">
            {data.teams.map((t) => {
              const label = LEVEL_LABEL[t.teamLevel] || t.teamLevel
              const selected = t.id === selectedTeamId
              return (
                <Button
                  key={t.id}
                  type="button"
                  variant={selected ? "default" : "outline"}
                  className="min-w-[6.5rem] border-border"
                  aria-selected={selected}
                  role="tab"
                  onClick={() => setSelectedTeamId(t.id)}
                >
                  {label}
                </Button>
              )
            })}
          </div>
          {selectedTeamId && selectedTeam && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Button className="w-full sm:w-auto" asChild>
                <Link
                  href={selectedTeamPortalHref}
                  // Same as AD teams table: no hover prefetch for heavy `/dashboard?teamId=` navigation.
                  prefetch={false}
                >
                  Open {selectedLevelLabel} portal ({selectedTeam.name})
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground sm:max-w-md">
                Use header <span className="font-medium text-foreground">Organization</span> to return to this
                organization portal area from a team dashboard.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">JV &amp; Freshman head coaches</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Program structure only. Must be an activated assistant in this program.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">JV head coach</label>
            <p className="text-xs text-muted-foreground">
              Program designation only. Place the coach on the JV team above first; then set job titles in that
              team&apos;s Settings → Users.
            </p>
            <select
              className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={jvHeadId}
              disabled={Boolean(saving)}
              onChange={(e) => assignHead("jv_head", e.target.value || null)}
            >
              <option value="">Unassigned</option>
              {assignmentOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Freshman head coach</label>
            <p className="text-xs text-muted-foreground">
              Program designation only. Place the coach on the Freshman team first; job titles stay in that team&apos;s
              Settings.
            </p>
            <select
              className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={frHeadId}
              disabled={Boolean(saving)}
              onChange={(e) => assignHead("freshman_head", e.target.value || null)}
            >
              <option value="">Unassigned</option>
              {assignmentOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assign assistants to a team</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">
            Set which roster/portal (Varsity, JV, or Freshman) a coach belongs to. Each team&apos;s head coach then
            assigns OC / DC / position roles in Settings.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.staff.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assistant coaches linked to this program yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {data.staff.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                    {s.staffStatus === "pending_assignment" && (
                      <p className="mt-1 text-xs text-amber-700">Pending activation — activate in Settings → Users</p>
                    )}
                  </div>
                  <select
                    className="w-full rounded-md border border-border bg-background px-2 py-2 text-sm sm:w-56"
                    value={s.teamId || ""}
                    disabled={Boolean(saving) || s.staffStatus === "pending_assignment"}
                    onChange={(e) => {
                      const next = e.target.value
                      if (!next) return
                      void assignStaffTeam(s.id, next)
                    }}
                  >
                    <option value="">Choose team (Varsity / JV / Freshman)…</option>
                    {data.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {LEVEL_LABEL[t.teamLevel] || t.teamLevel}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" asChild>
          <Link href="/dashboard/settings" prefetch={false}>
            Settings (users &amp; coaching titles)
          </Link>
        </Button>
      </div>
    </div>
  )
}
