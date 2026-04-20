import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolvePlayerDocumentAccess } from "@/lib/player-documents/access"
import { effectiveDocumentStatus } from "@/lib/player-documents/status"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

/**
 * GET /api/player-documents?teamId=&playerId=&includeExpired=&status=
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const playerIdParam = searchParams.get("playerId")
    const includeExpired = searchParams.get("includeExpired") === "1" || searchParams.get("includeExpired") === "true"
    const statusFilter = searchParams.get("status") // active | expired | all

    if (!teamId || !playerIdParam) {
      return NextResponse.json({ error: "teamId and playerId are required" }, { status: 400 })
    }

    const playerIdResolved = await resolveRosterApiPlayerUuid(teamId, playerIdParam)
    if (!playerIdResolved) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }
    const playerId = playerIdResolved
    const supabase = getSupabaseServer()
    const access = await resolvePlayerDocumentAccess(supabase, session.user.id, playerId, teamId)
    if (!access?.canView) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: rows, error } = await supabase
      .from("player_documents")
      .select(
        "id, player_id, team_id, title, file_name, file_url, file_path, mime_type, file_size, file_size_bytes, document_type, category, created_at, uploaded_at, created_by, uploaded_by_profile_id, visible_to_player, consent_text, retention_days, expires_at, deleted_at, status, season_label, notes"
      )
      .eq("player_id", playerId)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false })
    if (error) {
      console.error("[GET /api/player-documents]", error.message)
      return NextResponse.json({ error: "Failed to load documents" }, { status: 500 })
    }

    const uploaderIds = [
      ...new Set(
        (rows ?? [])
          .flatMap((r) => {
            const x = r as { uploaded_by_profile_id?: string; created_by?: string }
            return [x.uploaded_by_profile_id, x.created_by].filter(Boolean) as string[]
          })
      ),
    ]
    let nameById = new Map<string, string | null>()
    if (uploaderIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", uploaderIds)
      nameById = new Map((profs ?? []).map((p) => [(p as { id: string }).id, (p as { full_name: string | null }).full_name]))
    }

    const { data: player } = await supabase
      .from("players")
      .select("first_name, last_name")
      .eq("id", playerId)
      .maybeSingle()
    const playerName = player
      ? `${(player as { first_name?: string }).first_name ?? ""} ${(player as { last_name?: string }).last_name ?? ""}`.trim()
      : ""

    const documents = (rows ?? [])
      .map((raw) => {
        const d = raw as Record<string, unknown>
        const eff = effectiveDocumentStatus({
          deleted_at: d.deleted_at as string | null,
          expires_at: d.expires_at as string | null,
          status: d.status as string | null,
        })
        if (!includeExpired && eff === "expired") {
          return null
        }
        if (statusFilter && statusFilter !== "all" && eff !== statusFilter) {
          return null
        }
        const docType = (d.document_type as string) || (d.category as string) || "other"
        const uploadedBy =
          (d.uploaded_by_profile_id as string | undefined) ?? (d.created_by as string | undefined)
        return {
          id: d.id as string,
          playerId: d.player_id as string,
          teamId: d.team_id as string,
          title: (d.title as string) ?? "",
          fileName: (d.file_name as string) ?? "",
          storageBacked: Boolean(d.file_path),
          legacyFileUrl: (d.file_url as string | null) ?? null,
          mimeType: (d.mime_type as string | null) ?? null,
          fileSize: (d.file_size_bytes as number | null) ?? (d.file_size as number | null),
          documentType: docType,
          createdAt: (d.uploaded_at as string) ?? (d.created_at as string),
          expiresAt: d.expires_at as string | null,
          retentionDays: d.retention_days as number | null,
          visibleToPlayer: d.visible_to_player !== false,
          uploadedBy: uploadedBy ? nameById.get(uploadedBy) ?? null : null,
          seasonLabel: (d.season_label as string | null) ?? null,
          notes: (d.notes as string | null) ?? null,
          effectiveStatus: eff,
          consentText: (d.consent_text as string) ?? null,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    return NextResponse.json({
      documents,
      playerName,
      access: {
        canUpload: access.canUpload,
        canExport: access.canExport,
        canDelete: access.canDelete,
        canManageVisibility: access.canManageVisibility,
      },
    })
  } catch (err) {
    console.error("[GET /api/player-documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
