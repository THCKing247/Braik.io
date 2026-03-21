import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership } from "@/lib/auth/rbac"
import { ROLES } from "@/lib/auth/roles"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

function canShareDocument(createdBy: string, userId: string, role: string): boolean {
  if (createdBy === userId) return true
  return (
    role === ROLES.HEAD_COACH ||
    role === ROLES.ASSISTANT_COACH ||
    role === ROLES.ATHLETIC_DIRECTOR
  )
}

async function getTeamUserIdSet(
  supabase: ReturnType<typeof getSupabaseServer>,
  teamId: string
): Promise<Set<string>> {
  const ids = new Set<string>()
  const { data: members } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("active", true)
  members?.forEach((m: { user_id?: string }) => {
    if (m.user_id) ids.add(m.user_id)
  })
  const { data: players } = await supabase
    .from("players")
    .select("user_id")
    .eq("team_id", teamId)
    .not("user_id", "is", null)
  players?.forEach((p: { user_id?: string | null }) => {
    if (p.user_id) ids.add(p.user_id)
  })
  const { data: profileTeam } = await supabase
    .from("profiles")
    .select("id")
    .eq("team_id", teamId)
  profileTeam?.forEach((p: { id: string }) => ids.add(p.id))
  return ids
}

type ShareBody = {
  addUserIds?: string[]
  removeUserIds?: string[]
  publicShareEnabled?: boolean
}

/**
 * POST /api/documents/[documentId]/share
 * Update direct shares and/or public link (team members with share permission only).
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
    if (!documentId) {
      return NextResponse.json({ error: "documentId is required" }, { status: 400 })
    }

    let body: ShareBody
    try {
      body = (await request.json()) as ShareBody
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, team_id, created_by, public_share_token")
      .eq("id", documentId)
      .maybeSingle()

    if (docErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const membership = await getUserMembership(doc.team_id)
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!canShareDocument(doc.created_by, session.user.id, membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const teamUserIds = await getTeamUserIdSet(supabase, doc.team_id)

    if (body.publicShareEnabled === true) {
      const token = doc.public_share_token || randomBytes(24).toString("hex")
      const { error: upErr } = await supabase
        .from("documents")
        .update({ public_share_token: token, updated_at: new Date().toISOString() })
        .eq("id", documentId)
      if (upErr) {
        console.error("[POST share] public token", upErr.message)
        return NextResponse.json({ error: "Failed to update public link" }, { status: 500 })
      }
    } else if (body.publicShareEnabled === false) {
      const { error: upErr } = await supabase
        .from("documents")
        .update({ public_share_token: null, updated_at: new Date().toISOString() })
        .eq("id", documentId)
      if (upErr) {
        console.error("[POST share] clear token", upErr.message)
        return NextResponse.json({ error: "Failed to clear public link" }, { status: 500 })
      }
    }

    const addIds = (body.addUserIds ?? []).filter((id) => id && id !== session.user.id)
    const removeIds = body.removeUserIds ?? []

    for (const uid of addIds) {
      if (!teamUserIds.has(uid)) {
        continue
      }
      const { error: insErr } = await supabase.from("document_shares").insert({
        document_id: documentId,
        shared_with_user_id: uid,
      })
      if (insErr && insErr.code !== "23505") {
        console.error("[POST share] insert", insErr.message)
        return NextResponse.json({ error: "Failed to add share" }, { status: 500 })
      }
    }

    for (const uid of removeIds) {
      await supabase
        .from("document_shares")
        .delete()
        .eq("document_id", documentId)
        .eq("shared_with_user_id", uid)
    }

    const { data: updated } = await supabase
      .from("documents")
      .select("public_share_token")
      .eq("id", documentId)
      .single()

    trackProductEventServer({
      eventName: BRAIK_EVENTS.docs.share_updated,
      userId: session.user.id,
      teamId: doc.team_id,
      role: membership.role,
      metadata: {
        document_id: documentId,
        add_count: addIds.length,
        remove_count: removeIds.length,
        public_toggled: body.publicShareEnabled !== undefined,
      },
    })

    return NextResponse.json({
      ok: true,
      publicShareToken: updated?.public_share_token ?? null,
    })
  } catch (err) {
    console.error("[POST /api/documents/[documentId]/share]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
