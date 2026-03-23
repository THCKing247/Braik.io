import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

export const runtime = "nodejs"

function isAssistantProfileRole(role: string): boolean {
  const r = role.trim().toLowerCase().replace(/-/g, "_")
  return r === "assistant_coach"
}

/**
 * PATCH /api/teams/[teamId]/users/[userId]/staff-status
 * Activate a pending assistant (Director of Football / HC / delegated level head with manage).
 */
export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string; userId: string } }
) {
  try {
    const { teamId, userId } = params
    if (!teamId || !userId) {
      return NextResponse.json({ error: "teamId and userId are required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage")

    const body = (await request.json()) as { staffStatus?: string }
    if (body.staffStatus !== "active") {
      return NextResponse.json({ error: "Only staffStatus active is supported" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("id, role, team_id")
      .eq("id", userId)
      .maybeSingle()

    if (profErr || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!isAssistantProfileRole(String(profile.role ?? ""))) {
      return NextResponse.json({ error: "Only assistant coaches use this workflow" }, { status: 400 })
    }

    if (profile.team_id !== teamId) {
      return NextResponse.json({ error: "User is not linked to this team" }, { status: 400 })
    }

    const { data: tm, error: tmErr } = await supabase
      .from("team_members")
      .select("staff_status")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .eq("active", true)
      .maybeSingle()

    if (tmErr || !tm) {
      return NextResponse.json({ error: "No team membership to update" }, { status: 404 })
    }

    if (String((tm as { staff_status?: string }).staff_status) !== "pending_assignment") {
      return NextResponse.json({ error: "Staff is already active" }, { status: 400 })
    }

    const { error: upErr } = await supabase
      .from("team_members")
      .update({ staff_status: "active" })
      .eq("team_id", teamId)
      .eq("user_id", userId)

    if (upErr) {
      console.error("[PATCH staff-status]", upErr)
      return NextResponse.json({ error: "Failed to update staff status" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error"
    console.error("[PATCH /api/teams/.../staff-status]", error)
    return NextResponse.json(
      { error: msg },
      { status: msg.includes("Access denied") ? 403 : 500 }
    )
  }
}
