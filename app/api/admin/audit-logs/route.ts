import { NextResponse } from "next/server"
import { requirePermissionForApi } from "@/lib/permissions/platform-permissions"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function GET(request: Request) {
  try {
    const access = await requirePermissionForApi("view_audit_logs")
    if (!access.ok) {
      return access.response
    }

    const url = new URL(request.url)
    const action = url.searchParams.get("action") || undefined
    const targetType = url.searchParams.get("targetType") || undefined

    const supabase = getSupabaseServer()
    let query = supabase
      .from("audit_logs")
      .select("id, actor_id, action, target_type, target_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200)

    if (action) query = query.ilike("action", `%${action}%`)
    if (targetType) query = query.eq("target_type", targetType)

    const { data: rows } = await query
    const raw = rows ?? []
    const actorIds = [...new Set(raw.map((r) => r.actor_id).filter(Boolean))] as string[]
    const { data: actorUsers } =
      actorIds.length > 0
        ? await supabase.from("users").select("id, email, name").in("id", actorIds)
        : { data: [] as { id: string; email: string; name: string | null }[] }
    const actorById = new Map((actorUsers ?? []).map((u) => [u.id, u]))

    const logs = raw.map((r) => {
      const actor = r.actor_id ? actorById.get(r.actor_id as string) : undefined
      return {
        id: r.id,
        actorId: r.actor_id,
        actorEmail: actor?.email ?? null,
        actorName: actor?.name?.trim() || null,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        metadata: r.metadata,
        createdAt: r.created_at,
      }
    })

    return NextResponse.json({ ok: true, logs })
  } catch (error: unknown) {
    console.error("Admin audit logs error:", error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
