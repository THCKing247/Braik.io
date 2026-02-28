import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"
import { appendSystemConfigVersion, listSystemConfig } from "@/lib/system-config-store"

export async function GET(request: Request) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) return access.response

    const rows = await listSystemConfig(300)
    return NextResponse.json({ rows })
  } catch (error: any) {
    console.error("admin system-config GET error", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) return access.response

    const body = await request.json()
    const key = typeof body.key === "string" ? body.key.trim() : ""
    const valueJson = body.valueJson ?? {}
    const appliedScope =
      body.appliedScope === "future_only" || body.appliedScope === "all" || body.appliedScope === "selective"
        ? body.appliedScope
        : null
    const appliedTeamIds = Array.isArray(body.appliedTeamIds)
      ? body.appliedTeamIds.filter((id: unknown): id is string => typeof id === "string")
      : []

    if (!key || !appliedScope) {
      return NextResponse.json({ error: "key and appliedScope are required" }, { status: 400 })
    }
    if (appliedScope === "selective" && appliedTeamIds.length === 0) {
      return NextResponse.json({ error: "appliedTeamIds required for selective scope" }, { status: 400 })
    }

    const created = await appendSystemConfigVersion({
      key,
      valueJson,
      appliedScope,
      appliedTeamIds: appliedScope === "selective" ? appliedTeamIds : null,
      appliedBy: access.context.actorId,
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "system_config_version_created",
      targetType: "system_config",
      targetId: `${created.key}:v${created.version}`,
      metadata: {
        key: created.key,
        version: created.version,
        appliedScope: created.applied_scope,
        appliedTeamIds: created.applied_team_ids,
      },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    }).catch(() => undefined)

    return NextResponse.json({ success: true, row: created })
  } catch (error: any) {
    console.error("admin system-config POST error", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
