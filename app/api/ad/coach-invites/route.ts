import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { canAccessAdPortalRoutes, resolveFootballAdAccessState } from "@/lib/enforcement/football-ad-access"
import { assertTeamInAdPortalScope } from "@/lib/ad-portal-coach-assignments"
import { generateUniqueInviteCode } from "@/lib/invites/invite-codes"

export const runtime = "nodejs"

/**
 * AD portal: create coach invite codes scoped to a visible team (team/program fields only — no program_members gate).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServer()
    const access = await resolveFootballAdAccessState(supabase, session.user.id)
    if (!canAccessAdPortalRoutes(access)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json()) as {
      teamId?: string
      roleType?: "head_coach" | "assistant_coach"
      expiresInDays?: number
    }

    const teamId = typeof body.teamId === "string" ? body.teamId.trim() : ""
    const roleType = body.roleType
    if (!teamId || (roleType !== "head_coach" && roleType !== "assistant_coach")) {
      return NextResponse.json(
        { error: "teamId and roleType (head_coach | assistant_coach) are required." },
        { status: 400 }
      )
    }

    const inScope = await assertTeamInAdPortalScope(supabase, session.user.id, teamId)
    if (!inScope) {
      return NextResponse.json({ error: "Team not in your scope." }, { status: 403 })
    }

    const { data: teamRow, error: teamErr } = await supabase
      .from("teams")
      .select("id, program_id")
      .eq("id", teamId)
      .maybeSingle()

    if (teamErr || !teamRow?.id) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 })
    }

    const programId = (teamRow as { program_id?: string | null }).program_id ?? null
    if (roleType === "assistant_coach" && !programId) {
      return NextResponse.json(
        { error: "Assistant coach invites require a program-linked team." },
        { status: 400 }
      )
    }

    const expiresInDays =
      typeof body.expiresInDays === "number" && body.expiresInDays > 0
        ? Math.min(90, Math.floor(body.expiresInDays))
        : 14
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()

    const inviteType =
      roleType === "head_coach" ? "head_coach_team_invite" : "assistant_coach_invite"

    const code = await generateUniqueInviteCode(supabase, 8)

    const insertPayload: Record<string, unknown> = {
      code,
      invite_type: inviteType,
      organization_id: null,
      program_id: programId,
      team_id: teamId,
      target_player_id: null,
      max_uses: 1,
      expires_at: expiresAt,
      is_active: true,
      created_by_user_id: session.user.id,
    }

    const { data: row, error } = await supabase
      .from("invite_codes")
      .insert(insertPayload)
      .select("id, code, invite_type, team_id, program_id, expires_at")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message ?? "Failed to create invite." }, { status: 500 })
    }

    return NextResponse.json(row)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
