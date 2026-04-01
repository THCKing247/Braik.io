import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"

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
  if (typeof body.aiEnabled === "boolean") patch.ai_enabled = body.aiEnabled
  if (typeof body.aiDisabledByPlatform === "boolean") patch.ai_disabled_by_platform = body.aiDisabledByPlatform
  if (typeof body.baseAiCredits === "number" && Number.isFinite(body.baseAiCredits)) {
    patch.base_ai_credits = Math.max(0, Math.floor(body.baseAiCredits))
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const supabase = getSupabaseServer()

  async function tryUpdate(p: Record<string, unknown>) {
    return supabase.from("teams").update(p).eq("id", teamId).select("id, base_ai_credits, ai_enabled, ai_disabled_by_platform").maybeSingle()
  }

  let { data, error } = await tryUpdate(patch)

  if (error) {
    const msg = error.message ?? ""
    const missingAiCol = /ai_enabled|ai_disabled|does not exist|PGRST204/i.test(msg)
    if (missingAiCol && ("ai_enabled" in patch || "ai_disabled_by_platform" in patch)) {
      const rest = { ...patch }
      delete rest.ai_enabled
      delete rest.ai_disabled_by_platform
      console.warn("[admin/api/teams/ai PATCH] retry without AI columns", { teamId })
      const retry = await tryUpdate(rest)
      data = retry.data
      error = retry.error
    }
  }

  if (error) {
    console.error("[admin/api/teams/ai PATCH] supabase error", { teamId, message: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 })
  }

  await writeAdminAuditLog({
    actorId: access.context.actorId,
    action: "admin_team_ai_patch",
    targetType: "team",
    targetId: teamId,
    metadata: { patch },
  }).catch(() => undefined)

  return NextResponse.json({ team: data })
}
