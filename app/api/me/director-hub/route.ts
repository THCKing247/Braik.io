import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  resolveCanonicalTeamRouteByTeamId,
  resolveDefaultOrganizationPortalUuidForUser,
} from "@/lib/navigation/organization-routes"

export const runtime = "nodejs"

const LEVEL_ORDER: Record<string, number> = { varsity: 0, jv: 1, freshman: 2 }

function isFootballSport(sport: string | null | undefined): boolean {
  return String(sport ?? "")
    .trim()
    .toLowerCase() === "football"
}

function normalizeTeamMemberRole(role: string | null | undefined): string {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
}

/**
 * LEGACY_TRANSITION: only for programs with no `created_by_user_id` yet.
 * Primary varsity HC on football program — not used when a program owner row exists (explicit model).
 */
async function userIsPrimaryVarsityHeadCoach(
  supabase: ReturnType<typeof getSupabaseServer>,
  userId: string,
  programId: string
): Promise<boolean> {
  const { data: varsityTeams, error: teamsErr } = await supabase
    .from("teams")
    .select("id")
    .eq("program_id", programId)
    .or("team_level.eq.varsity,team_level.is.null")

  if (teamsErr || !varsityTeams?.length) return false

  const varsityIds = varsityTeams.map((t) => (t as { id: string }).id)
  const { data: tmRows, error: tmErr } = await supabase
    .from("team_members")
    .select("role")
    .eq("user_id", userId)
    .in("team_id", varsityIds)
    .eq("active", true)
    .eq("is_primary", true)

  if (tmErr || !tmRows?.length) return false

  return tmRows.some((r) => normalizeTeamMemberRole((r as { role?: string }).role) === "head_coach")
}

type ProgramRow = {
  program_name?: string
  sport?: string
  created_by_user_id?: string | null
}

/**
 * GET /api/me/director-hub
 * Football program control center.
 *
 * Director eligibility (football only):
 * 1) PRIMARY: program_members.role === director_of_football
 * 2) LEGACY: program_members.role === head_coach AND (program owner OR primary varsity HC in team_members)
 */
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const supabase = getSupabaseServer()

    const { data: memberships } = await supabase
      .from("program_members")
      .select("program_id, role")
      .eq("user_id", userId)
      .eq("active", true)

    const rows = (memberships || []) as { program_id: string; role: string }[]
    const programIds = [...new Set(rows.map((r) => r.program_id))]
    if (programIds.length === 0) {
      return NextResponse.json({
        eligible: false,
        programId: null,
        programName: null,
        teams: [],
        coachAssignments: [],
        staff: [],
      })
    }

    const { data: programsData } = await supabase
      .from("programs")
      .select("id, program_name, sport, created_by_user_id")
      .in("id", programIds)

    const programById = new Map(
      (programsData || []).map((p) => {
        const row = p as { id: string } & ProgramRow
        return [row.id, row] as const
      })
    )

    const sortedMemberships = [...rows].sort((a, b) => {
      const pri = (r: string) => (r === "director_of_football" ? 0 : r === "head_coach" ? 1 : 2)
      const d = pri(a.role) - pri(b.role)
      return d !== 0 ? d : a.program_id.localeCompare(b.program_id)
    })

    let programId: string | null = null
    let programRole: string | null = null

    for (const m of sortedMemberships) {
      const r = String(m.role || "")
      if (r !== "director_of_football" && r !== "head_coach") continue

      const prog = programById.get(m.program_id)
      if (!prog || !isFootballSport(prog.sport)) continue

      const { count, error: cErr } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("program_id", m.program_id)

      if (cErr) continue
      if ((count ?? 0) < 1) continue

      if (r === "director_of_football") {
        programId = m.program_id
        programRole = r
        break
      }

      // LEGACY_TRANSITION: head_coach — owner always; primary varsity only if program has no creator row yet
      const ownerId = prog.created_by_user_id ?? null
      const isProgramOwner = ownerId === userId
      const legacyUnownedPrimaryVarsity =
        ownerId === null && (await userIsPrimaryVarsityHeadCoach(supabase, userId, m.program_id))
      if (isProgramOwner || legacyUnownedPrimaryVarsity) {
        programId = m.program_id
        programRole = r
        break
      }
    }

    if (!programId) {
      return NextResponse.json({
        eligible: false,
        programId: null,
        programName: null,
        teams: [],
        coachAssignments: [],
        staff: [],
      })
    }

    const program = programById.get(programId)

    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, team_level")
      .eq("program_id", programId)

    const teams = (teamsData || [])
      .map((t) => ({
        id: t.id as string,
        name: (t as { name?: string }).name ?? "",
        teamLevel: ((t as { team_level?: string | null }).team_level ?? "varsity") as string,
      }))
      .sort(
        (a, b) =>
          (LEVEL_ORDER[a.teamLevel] ?? 9) - (LEVEL_ORDER[b.teamLevel] ?? 9) ||
          a.name.localeCompare(b.name)
      )

    const teamShortIds: Record<string, string> = {}
    await Promise.all(
      teams.map(async (team) => {
        const canonical = await resolveCanonicalTeamRouteByTeamId(supabase, team.id)
        if (canonical?.shortTeamId) {
          teamShortIds[team.id] = canonical.shortTeamId
        }
      })
    )
    const organizationPortalUuid = await resolveDefaultOrganizationPortalUuidForUser(supabase, userId)

    const teamIds = teams.map((t) => t.id)

    const { data: assignRows } = await supabase
      .from("coach_assignments")
      .select("assignment_type, user_id")
      .eq("program_id", programId)

    const assignUserIds = [...new Set((assignRows || []).map((r) => (r as { user_id: string }).user_id))]
    let assignNames: Record<string, string> = {}
    if (assignUserIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", assignUserIds)
      assignNames = Object.fromEntries(
        (profs || []).map((p) => {
          const row = p as { id: string; full_name?: string | null; email?: string | null }
          return [row.id, (row.full_name || row.email || row.id).trim()]
        })
      )
    }

    const coachAssignments = (assignRows || []).map((r) => {
      const row = r as { assignment_type: string; user_id: string }
      return {
        assignmentType: row.assignment_type,
        userId: row.user_id,
        displayName: assignNames[row.user_id] ?? null,
      }
    })

    let staff: Array<{
      id: string
      name: string
      email: string
      teamId: string | null
      teamName: string | null
      teamLevel: string | null
      staffStatus: string | null
    }> = []

    if (teamIds.length > 0) {
      const { data: profList } = await supabase
        .from("profiles")
        .select("id, email, full_name, role, team_id")
        .in("team_id", teamIds)

      const assistants = (profList || []).filter((p) => {
        const role = String((p as { role?: string }).role || "")
          .toLowerCase()
          .replace(/-/g, "_")
        return role === "assistant_coach"
      })

      const { data: tmRows } = await supabase
        .from("team_members")
        .select("user_id, team_id, staff_status")
        .in("team_id", teamIds)
        .eq("active", true)

      const statusByUser = new Map<string, string>()
      for (const tm of tmRows || []) {
        const tr = tm as { user_id: string; staff_status?: string }
        statusByUser.set(tr.user_id, tr.staff_status || "active")
      }

      const teamMeta = new Map(teams.map((t) => [t.id, { name: t.name, level: t.teamLevel }]))

      staff = assistants.map((p) => {
        const row = p as { id: string; email?: string | null; full_name?: string | null; team_id?: string | null }
        const tid = row.team_id ?? null
        const meta = tid ? teamMeta.get(tid) : undefined
        return {
          id: row.id,
          name: (row.full_name || row.email || row.id).trim(),
          email: row.email || "",
          teamId: tid,
          teamName: meta?.name ?? null,
          teamLevel: meta?.level ?? null,
          staffStatus: statusByUser.get(row.id) ?? null,
        }
      })
    }

    return NextResponse.json({
      eligible: true,
      programId,
      programRole,
      programName: program?.program_name ?? null,
      sport: program?.sport ?? null,
      organizationPortalUuid,
      teamShortIds,
      teams,
      coachAssignments,
      staff,
    })
  } catch (e) {
    console.error("[GET /api/me/director-hub]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
