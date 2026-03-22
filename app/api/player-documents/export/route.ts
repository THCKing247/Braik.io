import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolvePlayerDocumentAccess } from "@/lib/player-documents/access"
import { createSignedUrlForPath } from "@/lib/player-documents/storage"
import { writeDocumentAuditLog } from "@/lib/player-documents/audit"
import { effectiveDocumentStatus } from "@/lib/player-documents/status"

/**
 * POST /api/player-documents/export
 * Body: { teamId, playerId, documentIds: string[] }
 * Head coach / AD only: returns short-lived signed URLs for each id (scoped).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      teamId?: string
      playerId?: string
      documentIds?: string[]
    }
    const teamId = body.teamId?.trim()
    const playerId = body.playerId?.trim()
    const documentIds = Array.isArray(body.documentIds) ? body.documentIds.filter(Boolean) : []
    if (!teamId || !playerId || documentIds.length === 0) {
      return NextResponse.json({ error: "teamId, playerId, and documentIds are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const access = await resolvePlayerDocumentAccess(supabase, session.user.id, playerId, teamId)
    if (!access?.canExport) {
      return NextResponse.json({ error: "Export is not available for your role." }, { status: 403 })
    }

    const { data: rows, error } = await supabase
      .from("player_documents")
      .select("id, team_id, player_id, file_name, file_path, file_url, title, deleted_at, expires_at, status")
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .in("id", documentIds)
      .is("deleted_at", null)

    if (error) {
      return NextResponse.json({ error: "Failed to load documents" }, { status: 500 })
    }

    const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
    const actorRole = (prof as { role?: string } | null)?.role ?? null

    const items: Array<{ id: string; fileName: string; title: string; url: string | null; effectiveStatus: string }> = []

    for (const raw of rows ?? []) {
      const d = raw as Record<string, unknown>
      const eff = effectiveDocumentStatus({
        deleted_at: d.deleted_at as string | null,
        expires_at: d.expires_at as string | null,
        status: d.status as string | null,
      })
      const id = d.id as string
      const filePath = d.file_path as string | null
      let url: string | null = null
      if (filePath) {
        const signed = await createSignedUrlForPath(supabase, filePath)
        url = signed.url
      } else if (typeof d.file_url === "string" && d.file_url.startsWith("/")) {
        const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
        const proto = request.headers.get("x-forwarded-proto") ?? "http"
        url = host ? `${proto}://${host}${d.file_url}` : d.file_url
      }
      items.push({
        id,
        fileName: (d.file_name as string) ?? "file",
        title: (d.title as string) ?? "",
        url,
        effectiveStatus: eff,
      })
    }

    await writeDocumentAuditLog(supabase, {
      documentId: documentIds[0],
      actorProfileId: session.user.id,
      actorRole,
      action: "bulk_export",
      accessMethod: "api",
      metadata: {
        team_id: teamId,
        player_id: playerId,
        document_ids: items.map((i) => i.id),
        count: items.length,
      },
    })

    return NextResponse.json({ items })
  } catch (err) {
    console.error("[POST /api/player-documents/export]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
