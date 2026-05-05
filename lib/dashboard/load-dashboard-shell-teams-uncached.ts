import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolveShortOrgIdsForOrganizationPortalUuids } from "@/lib/navigation/organization-routes"
import { braikPerfServerEnabled } from "@/lib/perf/braik-perf-config"
import { perfLogServer } from "@/lib/perf/braik-perf-server"

export type DashboardShellTeam = {
  id: string
  name: string
  shortOrgId?: string | null
  shortTeamId?: string | null
  organization: { name: string }
  sport: string
  seasonName: string
  primaryColor?: string
  secondaryColor?: string
  teamStatus?: string
  subscriptionPaid?: boolean
  amountPaid?: number
  players?: unknown[]
}

/**
 * Dashboard nav team list (service role). Used by RSC cache and by GET /api/dashboard/shell.
 * Does not use Supabase auth session APIs — only DB reads with service client.
 */
export async function loadDashboardShellTeamsUncached(
  effectiveUserId: string,
  sessionUserId: string,
  sessionTeamId: string | undefined,
  isImpersonating: boolean
): Promise<DashboardShellTeam[]> {
  const supabase = getSupabaseServer()

  const logPhase = (phase: string, started: number, extra?: Record<string, unknown>) => {
    if (!braikPerfServerEnabled()) return
    perfLogServer(`dashboard.shell.teams.${phase}`, {
      ms: Math.round(performance.now() - started),
      ...extra,
    })
  }

  let phaseStart = performance.now()
  const [membersRes, profileRes] = await Promise.all([
    supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", effectiveUserId)
      .eq("active", true),
    isImpersonating
      ? supabase.from("profiles").select("team_id").eq("id", effectiveUserId).maybeSingle()
      : Promise.resolve({ data: null as { team_id?: string | null } | null }),
  ])
  logPhase("members_profile", phaseStart)

  const membershipRows = membersRes.data
  const profileTeamId = isImpersonating ? profileRes.data?.team_id : undefined

  let teamIds: string[] = [...new Set((membershipRows ?? []).map((r) => r.team_id).filter(Boolean))]

  if (profileTeamId && !teamIds.includes(profileTeamId)) {
    teamIds = [...teamIds, profileTeamId]
  }

  if (!isImpersonating && sessionTeamId && !teamIds.includes(sessionTeamId)) {
    teamIds = [...teamIds, sessionTeamId]
  }

  if (teamIds.length === 0) {
    phaseStart = performance.now()
    const [hcRes, createdRes] = await Promise.all([
      supabase.from("teams").select("id").eq("head_coach_user_id", effectiveUserId),
      supabase.from("teams").select("id").eq("created_by", effectiveUserId),
    ])
    const hcTeams = hcRes.data
    const createdTeams = createdRes.data
    if (hcTeams?.length) {
      teamIds = hcTeams.map((t) => t.id)
    } else if (createdTeams?.length) {
      teamIds = createdTeams.map((t) => t.id)
    }
    logPhase("empty_membership_fallback", phaseStart)
  }

  if (teamIds.length === 0 && sessionTeamId && effectiveUserId === sessionUserId) {
    teamIds = [sessionTeamId]
  }

  if (teamIds.length === 0) return []

  phaseStart = performance.now()
  const { data: teamsData } = await supabase
    .from("teams")
    .select("id, name, created_at, athletic_department_id, program_id, team_status")
    .in("id", teamIds)

  const programIds = [...new Set((teamsData ?? []).map((t) => t.program_id).filter(Boolean))]
  const { data: programs } = programIds.length
    ? await supabase.from("programs").select("id, organization_id").in("id", programIds)
    : { data: [] as { id: string; organization_id: string | null }[] }
  const organizationIds = [...new Set((programs ?? []).map((p) => p.organization_id).filter(Boolean))]
  const { data: organizations } = organizationIds.length
    ? await supabase.from("organizations").select("id, athletic_department_id").in("id", organizationIds)
    : { data: [] as { id: string; athletic_department_id: string | null }[] }
  logPhase("teams_programs_orgs", phaseStart, {
    teamRows: (teamsData ?? []).length,
    programRows: (programs ?? []).length,
    orgRows: (organizations ?? []).length,
  })

  const programToOrg = new Map((programs ?? []).map((p) => [p.id, p.organization_id ?? null]))
  const orgToPortal = new Map((organizations ?? []).map((o) => [o.id, o.athletic_department_id ?? null]))
  const teamToPortal = new Map<string, string | null>()
  for (const team of teamsData ?? []) {
    const direct = team.athletic_department_id ?? null
    if (direct) {
      teamToPortal.set(team.id, direct)
      continue
    }
    const orgId = team.program_id ? programToOrg.get(team.program_id) ?? null : null
    teamToPortal.set(team.id, orgId ? orgToPortal.get(orgId) ?? null : null)
  }

  const byPortal = new Map<string, { id: string; createdAtMs: number }[]>()
  for (const team of teamsData ?? []) {
    const portal = teamToPortal.get(team.id)
    if (!portal) continue
    const list = byPortal.get(portal) ?? []
    list.push({
      id: team.id,
      createdAtMs: team.created_at ? Date.parse(team.created_at) : 0,
    })
    byPortal.set(portal, list)
  }
  const shortByTeamId = new Map<string, string>()
  for (const list of byPortal.values()) {
    list
      .sort((a, b) => (a.createdAtMs === b.createdAtMs ? a.id.localeCompare(b.id) : a.createdAtMs - b.createdAtMs))
      .forEach((team, index) => {
        shortByTeamId.set(team.id, String(index + 1))
      })
  }
  const portalKeys = [...byPortal.keys()]
  phaseStart = performance.now()
  const shortOrgBatch =
    portalKeys.length > 0
      ? await resolveShortOrgIdsForOrganizationPortalUuids(supabase, portalKeys)
      : new Map<string, string | null>()
  logPhase("short_org_ids", phaseStart, { portalCount: portalKeys.length })
  const shortOrgByPortal = new Map<string, string | null>()
  for (const portalId of portalKeys) {
    shortOrgByPortal.set(portalId, shortOrgBatch.get(portalId) ?? null)
  }

  return (teamsData ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    shortOrgId: (() => {
      const portal = teamToPortal.get(t.id)
      return portal ? shortOrgByPortal.get(portal) ?? null : null
    })(),
    shortTeamId: shortByTeamId.get(t.id) ?? null,
    organization: { name: t.name ?? "" },
    sport: "football",
    seasonName: "",
    primaryColor: "#1e3a5f",
    secondaryColor: "#FFFFFF",
    teamStatus: (t.team_status as string | undefined) ?? "active",
    subscriptionPaid: false,
    amountPaid: 0,
    players: [],
  }))
}
