import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { AdTeamsPageClient } from "@/components/portal/ad/ad-teams-page-client"
import type { TeamRow } from "@/components/portal/ad/ad-teams-table"
import { fetchAdVisibleTeamsForAccess, logAdTeamVisibility } from "@/lib/ad-team-scope"
import { pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"

export const dynamic = "force-dynamic"

function formatTeamLevel(level: string | null | undefined): string {
  if (level == null || String(level).trim() === "") return "Varsity"
  const l = String(level).toLowerCase()
  if (l === "varsity") return "Varsity"
  if (l === "jv") return "JV"
  if (l === "freshman") return "Freshman"
  return String(level)
}

export default async function AdTeamsPage() {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
  const access = await getAdPortalAccessForUser(
    supabase,
    session.user.id,
    session.user.role?.toUpperCase()
  )
  const { scope, orFilter, teams: teamsData, error: teamsErr } = await fetchAdVisibleTeamsForAccess(
    supabase,
    session.user.id,
    access
  )

  const teams: TeamRow[] = []

  if (!orFilter) {
    logAdTeamVisibility("AdTeamsPage", {
      scope,
      sessionRole: session.user.role ?? null,
      teamCount: 0,
      teamIds: [],
      filter: null,
      queryError: "no_or_filter: missing school, department, and linked programs",
    })
  } else {
    logAdTeamVisibility("AdTeamsPage", {
      scope,
      sessionRole: session.user.role ?? null,
      teamCount: teamsData?.length ?? 0,
      teamIds: (teamsData ?? []).map((t) => t.id),
      filter: orFilter,
      queryError: teamsErr ?? null,
    })

    if (teamsData?.length) {
      const teamIds = teamsData.map((t) => t.id)
      const { data: staffRows } = await supabase
        .from("team_members")
        .select("team_id, user_id, role, is_primary")
        .in("team_id", teamIds)
        .eq("active", true)

      const staffByTeam = new Map<string, TeamMemberStaffRow[]>()
      for (const row of staffRows ?? []) {
        const tid = (row as { team_id: string }).team_id
        const list = staffByTeam.get(tid) ?? []
        list.push({
          user_id: (row as { user_id: string }).user_id,
          role: (row as { role: string }).role,
          is_primary: (row as { is_primary?: boolean | null }).is_primary,
        })
        staffByTeam.set(tid, list)
      }

      const coachUserIds = new Set<string>()
      const headCoachUserIdByTeam = new Map<string, string | null>()
      for (const tid of teamIds) {
        const uid = pickHeadCoachUserId(staffByTeam.get(tid) ?? [])
        headCoachUserIdByTeam.set(tid, uid)
        if (uid) coachUserIds.add(uid)
      }

      const { data: users } =
        coachUserIds.size > 0
          ? await supabase.from("users").select("id, name").in("id", [...coachUserIds])
          : { data: [] as { id: string; name: string | null }[] }

      const headCoachByTeam = new Map<string, string | null>()
      headCoachUserIdByTeam.forEach((userId, teamId) => {
        if (!userId) {
          headCoachByTeam.set(teamId, null)
          return
        }
        const u = users?.find((x) => x.id === userId)
        const name = u?.name?.trim() ?? null
        headCoachByTeam.set(teamId, name && name.length > 0 ? name : null)
      })

      const now = new Date().toISOString()
      const { data: pendingInvites } = await supabase
        .from("invites")
        .select("team_id")
        .in("team_id", teamIds)
        .is("accepted_at", null)
        .gt("expires_at", now)

      const pendingTeamIds = new Set((pendingInvites ?? []).map((i) => i.team_id))

      const programIds = [
        ...new Set(
          teamsData.map((t) => t.program_id).filter((id): id is string => typeof id === "string" && id.length > 0)
        ),
      ]
      const sportByProgramId = new Map<string, string>()
      if (programIds.length > 0) {
        const { data: programs } = await supabase.from("programs").select("id, sport").in("id", programIds)
        for (const p of programs ?? []) {
          if (p?.id) sportByProgramId.set(p.id, (p.sport as string) || "football")
        }
      }

      const creatorIds = [
        ...new Set(
          teamsData
            .map((t) => t.created_by)
            .filter((id): id is string => typeof id === "string" && id.length > 0)
        ),
      ]
      const creatorNameById = new Map<string, string>()
      if (creatorIds.length > 0) {
        const { data: creatorUsers } = await supabase.from("users").select("id, name").in("id", creatorIds)
        for (const u of creatorUsers ?? []) {
          const nm = (u as { name?: string | null }).name?.trim()
          if (u?.id && nm) creatorNameById.set(u.id, nm)
        }
        const missing = creatorIds.filter((id) => !creatorNameById.has(id))
        if (missing.length > 0) {
          const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", missing)
          for (const p of profs ?? []) {
            const pid = (p as { id: string }).id
            const fn = (p as { full_name?: string | null }).full_name?.trim()
            if (pid && fn && !creatorNameById.has(pid)) creatorNameById.set(pid, fn)
          }
        }
      }

      teamsData.forEach((t) => {
        const headCoachName = headCoachByTeam.get(t.id) ?? null
        const invitePending = pendingTeamIds.has(t.id)
        const programId = t.program_id as string | null | undefined
        const sportFromProgram = programId ? sportByProgramId.get(programId) : undefined
        const createdBy = t.created_by ?? null
        const genderRaw = (t as { gender?: string | null }).gender
        teams.push({
          id: t.id,
          name: t.name ?? "",
          sport: t.sport ?? sportFromProgram ?? null,
          genderLabel: genderRaw?.trim() ? String(genderRaw) : "—",
          levelLabel: formatTeamLevel(t.team_level),
          rosterSize: t.roster_size ?? null,
          headCoachName,
          creatorName: createdBy ? creatorNameById.get(createdBy) ?? null : null,
          createdAt: t.created_at ?? new Date().toISOString(),
          invitePending,
        })
      })
    }
  }

  return <AdTeamsPageClient teams={teams} />
}
