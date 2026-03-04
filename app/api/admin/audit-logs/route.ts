import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function GET(request: Request) {
  try {
    const access = await getAdminAccessForApi()
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

    if (action) query = query.eq("action", action)
    if (targetType) query = query.eq("target_type", targetType)

    const { data: rows } = await query
    const logs = (rows ?? []).map((r) => ({
      id: r.id,
      actorId: r.actor_id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      metadata: r.metadata,
      createdAt: r.created_at,
    }))

    return NextResponse.json({ logs })
  } catch (error: unknown) {
    console.error("Admin audit logs error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
