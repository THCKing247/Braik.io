import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"
import { syncHeadCoachVideoViewForOrganizationTeams } from "@/lib/video/sync-head-coach-video-permission"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { orgId } = await params
  if (!orgId?.trim()) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 })
  }

  let body: { video_clips_enabled?: boolean }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (typeof body.video_clips_enabled !== "boolean") {
    return NextResponse.json({ error: "video_clips_enabled (boolean) is required" }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const { data: org, error } = await supabase
    .from("organizations")
    .update({ video_clips_enabled: body.video_clips_enabled })
    .eq("id", orgId)
    .select("id, name, slug, video_clips_enabled")
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  await writeAdminAuditLog({
    actorId: access.context.actorId,
    action: "organization_video_clips_patch",
    targetType: "organization",
    targetId: orgId,
    metadata: { video_clips_enabled: body.video_clips_enabled },
  }).catch(() => undefined)

  if (body.video_clips_enabled === true) {
    try {
      await syncHeadCoachVideoViewForOrganizationTeams(supabase, orgId)
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[video-perm-sync] after org video enable", {
          orgId,
          err: e instanceof Error ? e.message : String(e),
        })
      }
    }
  }

  return NextResponse.json({ organization: org })
}

export const runtime = "nodejs"
