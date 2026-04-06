import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireAnyPermissionForApi } from "@/lib/permissions/platform-permissions"

/**
 * GET /api/admin/document-audit?teamId=&playerId=&action=&from=&to=&limit=
 */
export async function GET(request: Request) {
  const gate = await requireAnyPermissionForApi(["view_audit_logs", "manage_documents"])
  if (!gate.ok) {
    return gate.response
  }

  const { searchParams } = new URL(request.url)
  const teamId = searchParams.get("teamId")
  const playerId = searchParams.get("playerId")
  const action = searchParams.get("action")
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const limitRaw = Number(searchParams.get("limit") ?? 100)
  const limit = Math.min(Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100, 500)

  const supabase = getSupabaseServer()

  let q = supabase
    .from("document_access_audit")
    .select("id, document_id, actor_profile_id, actor_role, action, access_method, ip_address, user_agent, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (action) {
    q = q.eq("action", action)
  }
  if (from) {
    q = q.gte("created_at", from)
  }
  if (to) {
    q = q.lte("created_at", to)
  }

  const { data: rows, error } = await q
  if (error) {
    console.error("[admin/document-audit]", error.message)
    return NextResponse.json({ error: "Failed to load audit log" }, { status: 500 })
  }

  const docIds = [...new Set((rows ?? []).map((r) => (r as { document_id: string }).document_id).filter(Boolean))]
  const docMeta = new Map<string, { player_id: string; team_id: string; file_name: string | null; title: string | null }>()
  if (docIds.length > 0) {
    const { data: docs } = await supabase
      .from("player_documents")
      .select("id, player_id, team_id, file_name, title")
      .in("id", docIds)
    for (const d of docs ?? []) {
      const x = d as { id: string; player_id: string; team_id: string; file_name: string | null; title: string | null }
      docMeta.set(x.id, {
        player_id: x.player_id,
        team_id: x.team_id,
        file_name: x.file_name,
        title: x.title,
      })
    }
  }

  const actorIds = [...new Set((rows ?? []).map((r) => (r as { actor_profile_id: string }).actor_profile_id).filter(Boolean))]
  const actorNames = new Map<string, string | null>()
  if (actorIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", actorIds)
    for (const p of profs ?? []) {
      const x = p as { id: string; full_name: string | null }
      actorNames.set(x.id, x.full_name ?? null)
    }
  }

  let entries = (rows ?? []).map((r) => {
    const row = r as Record<string, unknown>
    const dm = docMeta.get(row.document_id as string)
    return {
      id: row.id,
      documentId: row.document_id,
      createdAt: row.created_at,
      actorProfileId: row.actor_profile_id,
      actorName: actorNames.get(row.actor_profile_id as string) ?? null,
      actorRole: row.actor_role,
      action: row.action,
      accessMethod: row.access_method,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: row.metadata,
      teamId: dm?.team_id ?? null,
      playerId: dm?.player_id ?? null,
      documentName: dm?.file_name ?? dm?.title ?? null,
    }
  })

  if (teamId) entries = entries.filter((x) => x.teamId === teamId)
  if (playerId) entries = entries.filter((x) => x.playerId === playerId)

  return NextResponse.json({ ok: true, entries })
}
