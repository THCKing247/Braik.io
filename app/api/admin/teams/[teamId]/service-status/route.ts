import { NextRequest, NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"

export const runtime = "nodejs"

/** Must stay aligned with `AdminTeamStatusForm` / admin teams UI. */
const ALLOWED_TEAM_STATUSES = new Set(["active", "suspended", "cancelled", "terminated"])

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const access = await getAdminAccessForApi()
  if (!access.ok) return access.response

  const { teamId } = await params
  if (!teamId?.trim()) {
    return NextResponse.json({ error: "Missing team id" }, { status: 400 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>).teamStatus : undefined
  const teamStatus = typeof raw === "string" ? raw.trim().toLowerCase() : ""

  if (!teamStatus || !ALLOWED_TEAM_STATUSES.has(teamStatus)) {
    return NextResponse.json(
      {
        error: `Invalid teamStatus. Allowed: ${[...ALLOWED_TEAM_STATUSES].join(", ")}`,
      },
      { status: 400 }
    )
  }

  const supabase = getSupabaseServer()

  const { data: existing, error: loadErr } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 })
  }
  if (!existing) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 })
  }

  const { data: updated, error: upErr } = await supabase
    .from("teams")
    .update({ team_status: teamStatus })
    .eq("id", teamId)
    .select("id, team_status")
    .maybeSingle()

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 })
  }

  await writeAdminAuditLog({
    actorId: access.context.actorId,
    action: "admin_team_status_update",
    targetType: "team",
    targetId: teamId,
    metadata: { team_status: teamStatus },
  }).catch(() => undefined)

  return NextResponse.json({
    ok: true,
    team: updated ?? { id: teamId, team_status: teamStatus },
  })
}
