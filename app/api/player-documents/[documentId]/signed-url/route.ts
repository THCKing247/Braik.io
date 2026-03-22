import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolvePlayerDocumentAccess } from "@/lib/player-documents/access"
import { createSignedUrlForPath } from "@/lib/player-documents/storage"
import { writeDocumentAuditLog } from "@/lib/player-documents/audit"
import { effectiveDocumentStatus } from "@/lib/player-documents/status"

function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0]?.trim() ?? null
  return request.headers.get("x-real-ip")
}

/**
 * POST /api/player-documents/[documentId]/signed-url?teamId=&playerId=&intent=view|download
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { documentId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const playerId = searchParams.get("playerId")
    const intent = (searchParams.get("intent") ?? "view") as "view" | "download"
    if (!documentId || !teamId || !playerId) {
      return NextResponse.json({ error: "documentId, teamId, and playerId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const access = await resolvePlayerDocumentAccess(supabase, session.user.id, playerId, teamId)
    if (!access?.canView) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: doc, error: docErr } = await supabase
      .from("player_documents")
      .select(
        "id, player_id, team_id, file_path, file_url, title, file_name, deleted_at, expires_at, status, visible_to_player"
      )
      .eq("id", documentId)
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const row = doc as Record<string, unknown>
    if (row.deleted_at) {
      return NextResponse.json({ error: "Document is no longer available" }, { status: 410 })
    }

    const eff = effectiveDocumentStatus({
      deleted_at: row.deleted_at as string | null,
      expires_at: row.expires_at as string | null,
      status: row.status as string | null,
    })
    const isPlayerOrParent = access.isPlayer || access.isParent
    if (eff === "expired" && isPlayerOrParent) {
      return NextResponse.json({ error: "This document has expired. Contact your coach if you need a new copy." }, { status: 410 })
    }

    if (!access.canManageVisibility && row.visible_to_player === false && access.isPlayer) {
      return NextResponse.json({ error: "This document is not shared with players." }, { status: 403 })
    }

    const { data: prof } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle()
    const actorRole = (prof as { role?: string } | null)?.role ?? null
    const ua = request.headers.get("user-agent")

    const filePath = row.file_path as string | null
    const legacyUrl = row.file_url as string | null

    if (filePath) {
      const signed = await createSignedUrlForPath(supabase, filePath)
      if (signed.error || !signed.url) {
        return NextResponse.json({ error: signed.error ?? "Could not create link" }, { status: 500 })
      }

      await writeDocumentAuditLog(supabase, {
        documentId,
        actorProfileId: session.user.id,
        actorRole,
        action: "signed_url_generated",
        accessMethod: "api",
        ipAddress: clientIp(request),
        userAgent: ua,
        metadata: { intent, team_id: teamId, player_id: playerId, effective_status: eff },
      })

      await writeDocumentAuditLog(supabase, {
        documentId,
        actorProfileId: session.user.id,
        actorRole,
        action: intent === "download" ? "download" : "view",
        accessMethod: "api",
        ipAddress: clientIp(request),
        userAgent: ua,
        metadata: { team_id: teamId, player_id: playerId, effective_status: eff },
      })

      return NextResponse.json({
        url: signed.url,
        expiresInSeconds: 300,
        effectiveStatus: eff,
        isExpired: eff === "expired",
      })
    }

    if (legacyUrl && legacyUrl.startsWith("/")) {
      const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
      const proto = request.headers.get("x-forwarded-proto") ?? "http"
      const absolute = host ? `${proto}://${host}${legacyUrl}` : legacyUrl

      await writeDocumentAuditLog(supabase, {
        documentId,
        actorProfileId: session.user.id,
        actorRole,
        action: "signed_url_generated",
        accessMethod: "api",
        metadata: { legacy: true, intent },
      })
      await writeDocumentAuditLog(supabase, {
        documentId,
        actorProfileId: session.user.id,
        actorRole,
        action: intent === "download" ? "download" : "view",
        accessMethod: "api",
        ipAddress: clientIp(request),
        userAgent: ua,
        metadata: { legacy: true, team_id: teamId, player_id: playerId },
      })

      return NextResponse.json({
        url: absolute,
        legacyAppPath: legacyUrl,
        effectiveStatus: eff,
        isExpired: eff === "expired",
      })
    }

    return NextResponse.json({ error: "File not available" }, { status: 404 })
  } catch (err) {
    console.error("[POST signed-url]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
