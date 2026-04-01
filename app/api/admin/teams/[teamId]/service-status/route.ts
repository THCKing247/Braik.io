import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { teamId } = await params
  let body: { teamStatus?: string }
  try {
    body = (await request.json()) as { teamStatus?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (typeof body.teamStatus !== "string" || !body.teamStatus.trim()) {
    return NextResponse.json({ error: "teamStatus is required" }, { status: 400 })
  }

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from("teams")
    .update({ team_status: body.teamStatus.trim() })
    .eq("id", teamId)
    .select("id, team_status")
    .maybeSingle()

  if (error) {
    console.error("[admin/api/teams/service-status PATCH]", { teamId, message: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 })
  }

  await writeAdminAuditLog({
    actorId: access.context.actorId,
    action: "admin_team_service_status_patch",
    targetType: "team",
    targetId: teamId,
    metadata: { team_status: body.teamStatus },
  }).catch(() => undefined)

  return NextResponse.json({ team: data })
}
