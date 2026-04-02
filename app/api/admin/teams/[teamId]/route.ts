import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"
import { loadAdminTeamDetail } from "@/lib/admin/admin-team-detail"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { teamId } = await params
  console.info("[admin/api/teams GET] incoming teamId", { teamId })

  const supabase = getSupabaseServer()
  try {
    const detail = await loadAdminTeamDetail(supabase, teamId)
    if (!detail) {
      console.info("[admin/api/teams GET] not found", { teamId })
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }
    return NextResponse.json({ team: detail })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load team"
    console.error("[admin/api/teams GET] error", { teamId, message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { teamId } = await params
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.subscriptionStatus === "string") patch.subscription_status = body.subscriptionStatus
  if (typeof body.teamStatus === "string") patch.team_status = body.teamStatus
  if (typeof body.baseAiCredits === "number" && Number.isFinite(body.baseAiCredits)) {
    patch.base_ai_credits = Math.max(0, Math.floor(body.baseAiCredits))
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from("teams")
    .update(patch)
    .eq("id", teamId)
    .select("id, name, subscription_status, team_status, base_ai_credits")
    .maybeSingle()

  if (error) {
    console.error("[admin/api/teams PATCH] supabase error", { teamId, message: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 })
  }

  await writeAdminAuditLog({
    actorId: access.context.actorId,
    action: "admin_team_patch",
    targetType: "team",
    targetId: teamId,
    metadata: { patch },
  }).catch(() => undefined)

  return NextResponse.json({ team: data })
}
