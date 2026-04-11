import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"
import { collectTeamIdsForAthleticDepartment } from "@/lib/admin/athletic-departments-scope"
import type { PatchAthleticDepartmentTeamBody } from "@/lib/admin/athletic-departments-types"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { id: athleticDepartmentId, teamId } = await params
  let body: PatchAthleticDepartmentTeamBody
  try {
    body = (await request.json()) as PatchAthleticDepartmentTeamBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const allowedIds = await collectTeamIdsForAthleticDepartment(supabase, athleticDepartmentId)
  if (!allowedIds.includes(teamId)) {
    return NextResponse.json({ error: "Team is not under this athletic department" }, { status: 404 })
  }

  const { data: ad, error: adErr } = await supabase
    .from("athletic_departments")
    .select("video_clips_enabled, coach_b_plus_enabled")
    .eq("id", athleticDepartmentId)
    .maybeSingle()
  if (adErr) {
    return NextResponse.json({ error: adErr.message }, { status: 500 })
  }
  const adVideoOn = Boolean((ad as { video_clips_enabled?: boolean } | null)?.video_clips_enabled)
  const adCoachBPlusOn = Boolean((ad as { coach_b_plus_enabled?: boolean } | null)?.coach_b_plus_enabled)

  if (body.video_clips_enabled === true && !adVideoOn) {
    return NextResponse.json(
      {
        error: "Enable school-level video on this Athletic Department before turning on team video.",
        code: "AD_VIDEO_DISABLED",
      },
      { status: 400 }
    )
  }

  if (body.coach_b_plus_enabled === true && !adCoachBPlusOn) {
    return NextResponse.json(
      {
        error:
          "Enable school-level Coach B+ on this Athletic Department before turning on team Coach B+.",
        code: "AD_COACH_B_PLUS_DISABLED",
      },
      { status: 400 }
    )
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.video_clips_enabled === "boolean") {
    patch.video_clips_enabled = body.video_clips_enabled
  }
  if (typeof body.coach_b_plus_enabled === "boolean") {
    patch.coach_b_plus_enabled = body.coach_b_plus_enabled
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data: team, error: upErr } = await supabase
    .from("teams")
    .update(patch)
    .eq("id", teamId)
    .select("id, name, video_clips_enabled, coach_b_plus_enabled")
    .maybeSingle()

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  await writeAdminAuditLog({
    actorId: access.context.actorId,
    action: "athletic_department_team_patch",
    targetType: "team",
    targetId: teamId,
    metadata: { athleticDepartmentId, patch },
  }).catch(() => undefined)

  return NextResponse.json({ team })
}
