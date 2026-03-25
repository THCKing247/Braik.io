import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramStaffAdmin } from "@/lib/auth/rbac"
import { upsertStaffTeamMember } from "@/lib/team-members-sync"

export const runtime = "nodejs"

/**
 * PATCH /api/programs/[programId]/staff/[userId]/team
 * Director layer: move assistant coach's home team (profile + team_members) within the program.
 * Coaching titles (OC/DC/position) stay in team Head Coach settings.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { programId: string; userId: string } }
) {
  try {
    const { programId, userId } = params
    if (!programId || !userId) {
      return NextResponse.json({ error: "programId and userId required" }, { status: 400 })
    }

    await requireProgramStaffAdmin(programId)

    const body = (await request.json()) as { teamId?: string }
    const targetTeamId = body.teamId?.trim()
    if (!targetTeamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: progTeams, error: tErr } = await supabase
      .from("teams")
      .select("id")
      .eq("program_id", programId)

    if (tErr || !progTeams?.length) {
      return NextResponse.json({ error: "Program teams not found" }, { status: 404 })
    }

    const programTeamIds = progTeams.map((t) => t.id as string)
    if (!programTeamIds.includes(targetTeamId)) {
      return NextResponse.json({ error: "Team is not in this program" }, { status: 400 })
    }

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id, role, team_id")
      .eq("id", userId)
      .maybeSingle()

    if (pErr || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const r = String((profile as { role?: string }).role || "")
      .toLowerCase()
      .replace(/-/g, "_")
    if (r !== "assistant_coach") {
      return NextResponse.json({ error: "Only assistant coaches can be assigned to a program team here" }, { status: 400 })
    }

    await supabase
      .from("team_members")
      .update({ active: false })
      .eq("user_id", userId)
      .in("team_id", programTeamIds)

    const { error: profUp } = await supabase
      .from("profiles")
      .update({ team_id: targetTeamId })
      .eq("id", userId)

    if (profUp) {
      console.error("[PATCH staff team] profile", profUp)
      return NextResponse.json({ error: "Failed to update profile team" }, { status: 500 })
    }

    const { error: tmErr } = await upsertStaffTeamMember(supabase, targetTeamId, userId, "assistant_coach", {
      source: "director_hub_team_assignment",
      staffStatus: "active",
    })

    if (tmErr) {
      console.error("[PATCH staff team] team_members", tmErr)
      return NextResponse.json({ error: "Failed to update team membership" }, { status: 500 })
    }

    return NextResponse.json({ success: true, teamId: targetTeamId })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error"
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Access denied") ? 403 : 500 }
    )
  }
}
