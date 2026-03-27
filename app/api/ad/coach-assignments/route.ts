import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { canAccessAdPortalRoutes, resolveFootballAdAccessState } from "@/lib/enforcement/football-ad-access"
import { assertTeamInAdPortalScope } from "@/lib/ad-portal-coach-assignments"
import { revalidateAdCoachesBootstrapCache } from "@/lib/ad/ad-bootstrap-cache"
import { setPrimaryHeadCoach, upsertStaffTeamMember } from "@/lib/team-members-sync"
import { pickHeadCoachUserId, type TeamMemberStaffRow } from "@/lib/team-staff"

export const runtime = "nodejs"

async function resolvedHeadUserId(supabase: ReturnType<typeof getSupabaseServer>, teamId: string): Promise<string | null> {
  const { data } = await supabase
    .from("team_members")
    .select("user_id, role, is_primary")
    .eq("team_id", teamId)
    .eq("active", true)

  const rows: TeamMemberStaffRow[] = (data ?? []).map((r) => ({
    user_id: (r as { user_id: string }).user_id,
    role: (r as { role: string }).role,
    is_primary: (r as { is_primary?: boolean | null }).is_primary,
  }))
  return pickHeadCoachUserId(rows)
}

/** Assign primary head coach to a team that has none (existing Braik user by email). */
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

    const body = (await request.json()) as { teamId?: string; coachEmail?: string }
    const teamId = typeof body.teamId === "string" ? body.teamId.trim() : ""
    const coachEmail = typeof body.coachEmail === "string" ? body.coachEmail.trim().toLowerCase() : ""
    if (!teamId || !coachEmail) {
      return NextResponse.json({ error: "teamId and coachEmail are required." }, { status: 400 })
    }

    if (!(await assertTeamInAdPortalScope(supabase, session.user.id, teamId))) {
      return NextResponse.json({ error: "Team not in your scope." }, { status: 403 })
    }

    const existingHead = await resolvedHeadUserId(supabase, teamId)
    if (existingHead) {
      return NextResponse.json(
        { error: "This team already has a head coach. Edit that assignment first." },
        { status: 400 }
      )
    }

    const { data: prof } = await supabase.from("profiles").select("id").ilike("email", coachEmail).maybeSingle()
    const coachUserId = (prof as { id?: string } | null)?.id
    if (!coachUserId) {
      return NextResponse.json({ error: "No user found with that email." }, { status: 400 })
    }

    const { error } = await setPrimaryHeadCoach(supabase, teamId, coachUserId, { source: "ad_coaches_assign" })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    revalidateAdCoachesBootstrapCache()
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
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
      userId?: string
      sourceTeamId?: string
      fullName?: string | null
      targetTeamId?: string
      role?: "head_coach" | "assistant_coach"
    }

    const userId = typeof body.userId === "string" ? body.userId.trim() : ""
    const sourceTeamId = typeof body.sourceTeamId === "string" ? body.sourceTeamId.trim() : ""
    if (!userId || !sourceTeamId) {
      return NextResponse.json({ error: "userId and sourceTeamId are required." }, { status: 400 })
    }

    if (!(await assertTeamInAdPortalScope(supabase, session.user.id, sourceTeamId))) {
      return NextResponse.json({ error: "Source team not in your scope." }, { status: 403 })
    }

    const targetTeamId =
      typeof body.targetTeamId === "string" && body.targetTeamId.trim() ? body.targetTeamId.trim() : sourceTeamId

    if (!(await assertTeamInAdPortalScope(supabase, session.user.id, targetTeamId))) {
      return NextResponse.json({ error: "Target team not in your scope." }, { status: 403 })
    }

    const { data: membership, error: memErr } = await supabase
      .from("team_members")
      .select("team_id, user_id, role, active")
      .eq("team_id", sourceTeamId)
      .eq("user_id", userId)
      .eq("active", true)
      .in("role", ["head_coach", "assistant_coach"])
      .maybeSingle()

    if (memErr || !membership) {
      return NextResponse.json({ error: "No active coach membership found for this team." }, { status: 404 })
    }

    const currentRole = String((membership as { role: string }).role).toLowerCase()
    if (currentRole !== "head_coach" && currentRole !== "assistant_coach") {
      return NextResponse.json({ error: "Only head coach or assistant coach can be edited here." }, { status: 400 })
    }

    const targetRole = body.role ?? (currentRole as "head_coach" | "assistant_coach")
    if (targetRole !== "head_coach" && targetRole !== "assistant_coach") {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 })
    }

    if (body.fullName !== undefined && body.fullName !== null) {
      const fn = String(body.fullName).trim()
      await supabase.from("profiles").update({ full_name: fn || null }).eq("id", userId)
      await supabase.from("users").update({ name: fn || null }).eq("id", userId)
    }

    const sameTeam = sourceTeamId === targetTeamId
    const sameRole = currentRole === targetRole

    if (sameTeam && sameRole) {
      revalidateAdCoachesBootstrapCache()
      return NextResponse.json({ success: true })
    }

    async function deactivateStaffOnTeam(teamId: string, uid: string, role: string) {
      await supabase
        .from("team_members")
        .update({ active: false, is_primary: false })
        .eq("team_id", teamId)
        .eq("user_id", uid)
        .eq("role", role)
    }

    if (sameTeam && currentRole === "assistant_coach" && targetRole === "head_coach") {
      const headNow = await resolvedHeadUserId(supabase, sourceTeamId)
      if (headNow && headNow !== userId) {
        return NextResponse.json(
          { error: "This team already has a head coach. Edit that assignment first." },
          { status: 400 }
        )
      }
      await deactivateStaffOnTeam(sourceTeamId, userId, "assistant_coach")
      const { error: hcErr } = await setPrimaryHeadCoach(supabase, sourceTeamId, userId, {
        source: "ad_coaches_promote_assistant",
      })
      if (hcErr) return NextResponse.json({ error: hcErr.message }, { status: 500 })
      revalidateAdCoachesBootstrapCache()
      return NextResponse.json({ success: true })
    }

    if (sameTeam && currentRole === "head_coach" && targetRole === "assistant_coach") {
      await deactivateStaffOnTeam(sourceTeamId, userId, "head_coach")
      await supabase.from("teams").update({ head_coach_user_id: null }).eq("id", sourceTeamId).eq("head_coach_user_id", userId)
      const { error: asErr } = await upsertStaffTeamMember(supabase, sourceTeamId, userId, "assistant_coach", {
        source: "ad_coaches_demote_head",
      })
      if (asErr) return NextResponse.json({ error: asErr.message }, { status: 500 })
      revalidateAdCoachesBootstrapCache()
      return NextResponse.json({ success: true })
    }

    if (currentRole === "assistant_coach" && targetRole === "assistant_coach" && !sameTeam) {
      await deactivateStaffOnTeam(sourceTeamId, userId, "assistant_coach")
      const { error: asErr } = await upsertStaffTeamMember(supabase, targetTeamId, userId, "assistant_coach", {
        source: "ad_coaches_move_assistant",
      })
      if (asErr) return NextResponse.json({ error: asErr.message }, { status: 500 })
      revalidateAdCoachesBootstrapCache()
      return NextResponse.json({ success: true })
    }

    if (currentRole === "head_coach" && targetRole === "head_coach" && !sameTeam) {
      const headOnTarget = await resolvedHeadUserId(supabase, targetTeamId)
      if (headOnTarget && headOnTarget !== userId) {
        return NextResponse.json(
          { error: "Target team already has a head coach. Edit that assignment first." },
          { status: 400 }
        )
      }
      await deactivateStaffOnTeam(sourceTeamId, userId, "head_coach")
      await supabase.from("teams").update({ head_coach_user_id: null }).eq("id", sourceTeamId).eq("head_coach_user_id", userId)
      const { error: hcErr } = await setPrimaryHeadCoach(supabase, targetTeamId, userId, {
        source: "ad_coaches_move_head",
      })
      if (hcErr) return NextResponse.json({ error: hcErr.message }, { status: 500 })
      revalidateAdCoachesBootstrapCache()
      return NextResponse.json({ success: true })
    }

    if (currentRole === "assistant_coach" && targetRole === "head_coach" && !sameTeam) {
      const headOnTarget = await resolvedHeadUserId(supabase, targetTeamId)
      if (headOnTarget && headOnTarget !== userId) {
        return NextResponse.json(
          { error: "Target team already has a head coach. Edit that assignment first." },
          { status: 400 }
        )
      }
      await deactivateStaffOnTeam(sourceTeamId, userId, "assistant_coach")
      const { error: hcErr } = await setPrimaryHeadCoach(supabase, targetTeamId, userId, {
        source: "ad_coaches_assistant_to_head_move",
      })
      if (hcErr) return NextResponse.json({ error: hcErr.message }, { status: 500 })
      revalidateAdCoachesBootstrapCache()
      return NextResponse.json({ success: true })
    }

    if (currentRole === "head_coach" && targetRole === "assistant_coach" && !sameTeam) {
      await deactivateStaffOnTeam(sourceTeamId, userId, "head_coach")
      await supabase.from("teams").update({ head_coach_user_id: null }).eq("id", sourceTeamId).eq("head_coach_user_id", userId)
      const { error: asErr } = await upsertStaffTeamMember(supabase, targetTeamId, userId, "assistant_coach", {
        source: "ad_coaches_head_to_assistant_move",
      })
      if (asErr) return NextResponse.json({ error: asErr.message }, { status: 500 })
      revalidateAdCoachesBootstrapCache()
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unsupported assignment change." }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
