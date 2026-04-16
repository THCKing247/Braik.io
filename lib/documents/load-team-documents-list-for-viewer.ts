import type { SupabaseClient } from "@supabase/supabase-js"
import type { SessionUser } from "@/lib/auth/server-auth"
import { ROLES, type Role } from "@/lib/auth/roles"
import { teamDocumentVisibleToMember } from "@/lib/documents/document-visibility"

export type TeamDocumentListItem = {
  id: string
  title: string
  fileName: string
  category: string
  folder: string | null
  visibility: string
  scopedUnit: string | null
  scopedPositionGroups: unknown
  assignedPlayerIds: unknown
  createdAt: string
  mimeType: string | null
  publicShareToken: string | null
  storageBacked: boolean
  sharedWith: Array<{ id: string; name: string | null; email: string }>
  creator: { name: string | null; email: string }
  acknowledgements: Array<{ id: string }>
}

/** Shared by GET /api/documents and dashboard deferred-core bootstrap. */
export async function loadTeamDocumentsListForViewer(
  supabase: SupabaseClient,
  teamId: string,
  sessionUser: SessionUser
): Promise<TeamDocumentListItem[]> {
  const { data: membership } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", sessionUser.id)
    .eq("active", true)
    .maybeSingle()

  if (!membership) {
    throw new Error("Access denied: Not a member of this team")
  }

  const viewerRole = membership.role as Role

  let viewerPlayerRowIds: string[] = []
  if (viewerRole === ROLES.PLAYER) {
    const { data: playerRows } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", sessionUser.id)
    viewerPlayerRowIds = (playerRows ?? []).map((p) => p.id as string)
  }

  const { data: rows, error } = await supabase
    .from("documents")
    .select(
      "id, title, file_name, category, folder, visibility, scoped_unit, scoped_position_groups, assigned_player_ids, created_by, created_at, mime_type, public_share_token, file_path"
    )
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[loadTeamDocumentsListForViewer]", error.message, error)
    throw new Error("Failed to load documents")
  }

  const creatorIds = [...new Set((rows ?? []).map((r) => r.created_by))]
  let creatorMap = new Map<string, { name: string | null; email: string }>()
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, name, email").in("id", creatorIds)
    creatorMap = new Map((users ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }]))
  }

  const docIds = (rows ?? []).map((r) => r.id)
  let acksMap = new Map<string, Array<{ id: string }>>()
  if (docIds.length > 0) {
    const { data: acks } = await supabase
      .from("document_acknowledgements")
      .select("id, document_id")
      .in("document_id", docIds)
    acks?.forEach((a) => {
      const list = acksMap.get(a.document_id) ?? []
      list.push({ id: a.id })
      acksMap.set(a.document_id, list)
    })
  }

  let sharesByDoc = new Map<string, Array<{ id: string; name: string | null; email: string }>>()
  if (docIds.length > 0) {
    const { data: shareRows } = await supabase
      .from("document_shares")
      .select("document_id, shared_with_user_id")
      .in("document_id", docIds)

    const shareUserIds = [...new Set((shareRows ?? []).map((s) => s.shared_with_user_id))]
    let shareUsersMap = new Map<string, { name: string | null; email: string }>()
    if (shareUserIds.length > 0) {
      const { data: urows } = await supabase.from("users").select("id, name, email").in("id", shareUserIds)
      shareUsersMap = new Map((urows ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }]))
    }
    shareRows?.forEach((s) => {
      const u = shareUsersMap.get(s.shared_with_user_id)
      const entry = { id: s.shared_with_user_id, name: u?.name ?? null, email: u?.email ?? "" }
      const list = sharesByDoc.get(s.document_id) ?? []
      list.push(entry)
      sharesByDoc.set(s.document_id, list)
    })
  }

  const rawList = rows ?? []
  const visibleRows = rawList.filter((d) => {
    const shared = (sharesByDoc.get(d.id) ?? []).some((s) => s.id === sessionUser.id)
    if (shared) return true
    return teamDocumentVisibleToMember({
      visibility: d.visibility as string,
      assignedPlayerIds: d.assigned_player_ids,
      viewerRole,
      viewerPlayerRowIds,
    })
  })

  return visibleRows.map((d) => {
    const creator = creatorMap.get(d.created_by)
    return {
      id: d.id,
      title: d.title ?? "",
      fileName: d.file_name ?? "",
      category: d.category ?? "other",
      folder: d.folder ?? null,
      visibility: d.visibility ?? "all",
      scopedUnit: d.scoped_unit ?? null,
      scopedPositionGroups: d.scoped_position_groups ?? null,
      assignedPlayerIds: d.assigned_player_ids ?? null,
      createdAt: d.created_at,
      mimeType: d.mime_type ?? null,
      publicShareToken: d.public_share_token ?? null,
      storageBacked: Boolean((d as { file_path?: string | null }).file_path),
      sharedWith: sharesByDoc.get(d.id) ?? [],
      creator: creator ? { name: creator.name, email: creator.email } : { name: null, email: "" },
      acknowledgements: acksMap.get(d.id) ?? [],
    }
  })
}
