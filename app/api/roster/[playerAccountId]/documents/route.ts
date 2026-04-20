import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolvePlayerDocumentAccess } from "@/lib/player-documents/access"
import { effectiveDocumentStatus } from "@/lib/player-documents/status"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

/**
 * GET /api/roster/[playerAccountId]/documents?teamId=xxx
 * Legacy list shape for roster integrations; prefer GET /api/player-documents for new UI.
 * Each list item `playerId` field is the internal `players.id` UUID (row key), not the public `player_account_id` route segment.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerAccountId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerAccountId: segment } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!segment || !teamId) {
      return NextResponse.json({ error: "playerAccountId and teamId are required" }, { status: 400 })
    }

    const resolvedPlayerId = await resolveRosterApiPlayerUuid(teamId, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const supabase = getSupabaseServer()
    const access = await resolvePlayerDocumentAccess(supabase, session.user.id, resolvedPlayerId, teamId)
    if (!access?.canView) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { data: rows, error } = await supabase
      .from("player_documents")
      .select(
        "id, player_id, team_id, title, file_name, file_url, file_path, file_size, mime_type, category, document_type, created_at, uploaded_at, created_by, uploaded_by_profile_id, visible_to_player, deleted_at, expires_at, status"
      )
      .eq("player_id", resolvedPlayerId)
      .eq("team_id", teamId)
      .is("deleted_at", null)
      .order("uploaded_at", { ascending: false })

    if (error) {
      console.error("[GET /api/roster/[playerAccountId]/documents]", error.message)
      return NextResponse.json({ error: "Failed to load documents" }, { status: 500 })
    }

    const creatorIds = [
      ...new Set(
        (rows ?? [])
          .map((r) => (r as { uploaded_by_profile_id?: string; created_by?: string }).uploaded_by_profile_id)
          .filter(Boolean)
      ),
    ] as string[]
    let creatorMap = new Map<string, { name: string | null }>()
    if (creatorIds.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", creatorIds)
      creatorMap = new Map((profs ?? []).map((u) => [(u as { id: string }).id, { name: (u as { full_name: string | null }).full_name }]))
    }

    const isCoachStaff = access.canManageVisibility
    const documents = (rows ?? [])
      .map((d) => {
        const row = d as Record<string, unknown>
        const eff = effectiveDocumentStatus({
          deleted_at: row.deleted_at as string | null,
          expires_at: row.expires_at as string | null,
          status: row.status as string | null,
        })
        if (!isCoachStaff && eff === "expired") return null
        if (!isCoachStaff && row.visible_to_player === false) return null
        const cat = (row.document_type as string) || (row.category as string) || "other"
        const uploadedBy = (row.uploaded_by_profile_id as string | undefined) ?? (row.created_by as string | undefined)
        return {
          id: row.id as string,
          playerId: row.player_id as string,
          teamId: row.team_id as string,
          title: (row.title as string) ?? "",
          fileName: (row.file_name as string) ?? "",
          fileUrl: null,
          fileSize: (row.file_size as number | null) ?? null,
          mimeType: (row.mime_type as string | null) ?? null,
          category: cat,
          createdAt: (row.uploaded_at as string) ?? (row.created_at as string),
          visibleToPlayer: row.visible_to_player !== false,
          createdBy: uploadedBy ? creatorMap.get(uploadedBy)?.name ?? null : null,
          effectiveStatus: eff,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    return NextResponse.json(documents)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/roster/[playerAccountId]/documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/roster/[playerAccountId]/documents
 * Coach uploads disabled — use POST /api/player-documents/upload (player/parent).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Coach upload to this endpoint is disabled. Players and parents upload participation documents via the document upload flow.",
    },
    { status: 403 }
  )
}
