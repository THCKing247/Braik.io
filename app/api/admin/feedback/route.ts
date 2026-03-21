import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { safeAdminDbQuery } from "@/lib/admin/admin-db-safe"

/**
 * GET /api/admin/feedback?limit=50 — recent user feedback (platform admin only).
 */
export async function GET(request: Request) {
  const gate = await getAdminAccessForApi()
  if (!gate.ok) {
    return gate.response
  }

  const { searchParams } = new URL(request.url)
  const limitRaw = Number(searchParams.get("limit") ?? "40")
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 40

  const supabase = getSupabaseServer()

  const rows = await safeAdminDbQuery(async () => {
    const { data, error } = await supabase
      .from("user_feedback")
      .select("id, user_id, team_id, category, subject, body, page_path, user_role, created_at")
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  }, [])

  return NextResponse.json({ items: rows })
}
