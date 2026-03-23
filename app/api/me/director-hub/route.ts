import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export const runtime = "nodejs"

const LEVEL_ORDER: Record<string, number> = { varsity: 0, jv: 1, freshman: 2 }

/**
 * GET /api/me/director-hub
 * Football program control center: eligibility, program teams, staff for team placement, JV/Freshman head slots.
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

    let programId: string | null = null
    let programRole: string | null = null

    for (const m of memberships || []) {
      const row = m as { program_id: string; role: string }
      const r = String(row.role || "")
      if (r !== "director_of_football" && r !== "head_coach") continue

      const { count, error: cErr } = await supabase
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("program_id", row.program_id)

      if (cErr) continue
      const n = count ?? 0
      if (r === "director_of_football" && n >= 1) {
        programId = row.program_id
        programRole = r
        break
      }
      if (r === "head_coach" && n >= 2) {
        programId = row.program_id
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

    const { data: program } = await supabase
      .from("programs")
      .select("program_name, sport")
      .eq("id", programId)
      .maybeSingle()

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
      programName: (program as { program_name?: string } | null)?.program_name ?? null,
      sport: (program as { sport?: string } | null)?.sport ?? null,
      teams,
      coachAssignments,
      staff,
    })
  } catch (e) {
    console.error("[GET /api/me/director-hub]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
