import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolveAdPortalTeamScope, teamRowVisibleToAdScope } from "@/lib/ad-team-scope"
import { canAccessAdPortalRoutes } from "@/lib/enforcement/football-ad-access"
import { setPrimaryHeadCoach } from "@/lib/team-members-sync"

export const runtime = "nodejs"

const LEVELS = new Set(["varsity", "jv", "freshman"])

export async function PATCH(request: Request, { params }: { params: { teamId: string } }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const teamId = params.teamId
    if (!teamId) {
      return NextResponse.json({ error: "Missing team id" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { scope, footballAccess } = await resolveAdPortalTeamScope(supabase, session.user.id)
    if (!canAccessAdPortalRoutes(footballAccess)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: team } = await supabase
      .from("teams")
      .select(
        "id, name, sport, roster_size, team_level, gender, school_id, athletic_department_id, program_id"
      )
      .eq("id", teamId)
      .maybeSingle()

    if (!team?.id || !teamRowVisibleToAdScope(team, scope)) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const body = (await request.json()) as {
      teamName?: string
      sport?: string
      rosterSize?: number | null
      teamLevel?: string | null
      gender?: string | null
      headCoachEmail?: string | null
    }

    const updates: Record<string, unknown> = {}

    if (typeof body.teamName === "string") {
      const n = body.teamName.trim()
      if (!n) {
        return NextResponse.json({ error: "Team name cannot be empty" }, { status: 400 })
      }
      updates.name = n
    }

    if (typeof body.sport === "string") {
      const s = body.sport.trim()
      if (!s) {
        return NextResponse.json({ error: "Sport cannot be empty" }, { status: 400 })
      }
      updates.sport = s
    }

    if (body.rosterSize !== undefined) {
      if (body.rosterSize === null) {
        updates.roster_size = null
      } else {
        const n = Number(body.rosterSize)
        if (!Number.isFinite(n) || n < 0 || n > 500) {
          return NextResponse.json({ error: "Invalid roster size" }, { status: 400 })
        }
        updates.roster_size = Math.floor(n)
      }
    }

    if (body.teamLevel !== undefined) {
      if (body.teamLevel === null || body.teamLevel === "") {
        updates.team_level = null
      } else {
        const lv = String(body.teamLevel).toLowerCase()
        if (!LEVELS.has(lv)) {
          return NextResponse.json({ error: "Invalid team level" }, { status: 400 })
        }
        updates.team_level = lv
      }
    }

    if (body.gender !== undefined) {
      if (body.gender === null || body.gender === "") {
        updates.gender = null
      } else {
        const g = String(body.gender).trim().slice(0, 64)
        updates.gender = g || null
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase.from("teams").update(updates).eq("id", teamId)
      if (upErr) {
        return NextResponse.json({ error: upErr.message ?? "Update failed" }, { status: 500 })
      }
    }

    if (body.headCoachEmail !== undefined && body.headCoachEmail !== null) {
      const raw = String(body.headCoachEmail).trim().toLowerCase()
      if (raw) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", raw)
          .maybeSingle()
        const coachId = (prof as { id?: string } | null)?.id
        if (!coachId) {
          return NextResponse.json(
            { error: "No user found with that email. They must have a Braik account." },
            { status: 400 }
          )
        }
        const { error: hcErr } = await setPrimaryHeadCoach(supabase, teamId, coachId, {
          source: "ad_portal_team_edit",
        })
        if (hcErr) {
          return NextResponse.json({ error: hcErr.message ?? "Failed to set head coach" }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 })
  }
}
