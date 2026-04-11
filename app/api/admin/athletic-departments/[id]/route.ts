import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"
import {
  collectTeamIdsForAthleticDepartment,
  countActiveTeams,
  countAssistantCoachesOnTeams,
} from "@/lib/admin/athletic-departments-scope"
import { loadAthleticDepartmentDetail } from "@/lib/admin/athletic-departments-data"
import type { PatchAthleticDepartmentBody } from "@/lib/admin/athletic-departments-types"

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { id } = await params
  const supabase = getSupabaseServer()
  try {
    const detail = await loadAthleticDepartmentDetail(supabase, id)
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { id } = await params
  let body: PatchAthleticDepartmentBody
  try {
    body = (await request.json()) as PatchAthleticDepartmentBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const { data: existing, error: loadErr } = await supabase
    .from("athletic_departments")
    .select("id, teams_allowed, assistant_coaches_allowed, video_clips_enabled, coach_b_plus_enabled")
    .eq("id", id)
    .maybeSingle()
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const teamIds = await collectTeamIdsForAthleticDepartment(supabase, id)
  const activeTeamCount = await countActiveTeams(teamIds, supabase)
  const assistantUsage = await countAssistantCoachesOnTeams(supabase, teamIds)

  const nextTeamsAllowed =
    typeof body.teams_allowed === "number" && Number.isFinite(body.teams_allowed)
      ? Math.max(0, Math.floor(body.teams_allowed))
      : null
  const nextAssistantsAllowed =
    typeof body.assistant_coaches_allowed === "number" && Number.isFinite(body.assistant_coaches_allowed)
      ? Math.max(0, Math.floor(body.assistant_coaches_allowed))
      : null

  if (nextTeamsAllowed !== null && nextTeamsAllowed < activeTeamCount && !body.confirm_reduce_teams_below_active) {
    return NextResponse.json(
      {
        error: "teams_allowed would be below the current number of active teams. Confirm to proceed.",
        code: "CONFIRM_REDUCE_TEAMS",
        activeTeamCount,
        requested: nextTeamsAllowed,
      },
      { status: 409 }
    )
  }

  if (
    nextAssistantsAllowed !== null &&
    nextAssistantsAllowed < assistantUsage &&
    !body.confirm_reduce_assistants_below_usage
  ) {
    return NextResponse.json(
      {
        error:
          "assistant_coaches_allowed would be below the current assistant coach seat usage. Confirm to proceed.",
        code: "CONFIRM_REDUCE_ASSISTANTS",
        assistantCoachUsageCount: assistantUsage,
        requested: nextAssistantsAllowed,
      },
      { status: 409 }
    )
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (nextTeamsAllowed !== null) patch.teams_allowed = nextTeamsAllowed
  if (nextAssistantsAllowed !== null) patch.assistant_coaches_allowed = nextAssistantsAllowed
  if (typeof body.video_clips_enabled === "boolean") {
    patch.video_clips_enabled = body.video_clips_enabled
  }
  if (typeof body.coach_b_plus_enabled === "boolean") {
    patch.coach_b_plus_enabled = body.coach_b_plus_enabled
  }

  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data: updated, error: upErr } = await supabase
    .from("athletic_departments")
    .update(patch)
    .eq("id", id)
    .select("id, teams_allowed, assistant_coaches_allowed, video_clips_enabled, coach_b_plus_enabled")
    .maybeSingle()

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  await writeAdminAuditLog({
    actorId: access.context.actorId,
    action: "athletic_department_patch",
    targetType: "athletic_department",
    targetId: id,
    metadata: { patch, previous: existing },
  }).catch(() => undefined)

  return NextResponse.json({ athleticDepartment: updated })
}
