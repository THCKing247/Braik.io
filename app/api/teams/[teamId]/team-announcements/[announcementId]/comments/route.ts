import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { SessionUser } from "@/lib/auth/server-auth"

function membershipRoleToAuthorRole(role: string): string {
  return role.toLowerCase().replace(/-/g, "_")
}

type CommentRow = {
  id: string
  announcement_id: string
  parent_id: string | null
  user_id: string
  author_name: string | null
  author_role: string
  body: string
  created_at: string
  updated_at: string
}

type CommentWithReplies = CommentRow & { replies: CommentRow[] }

/**
 * GET /api/teams/[teamId]/team-announcements/[announcementId]/comments
 * Returns top-level comments with their replies nested.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; announcementId: string }> }
) {
  try {
    const { teamId, announcementId } = await params
    if (!teamId || !announcementId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 })
    }

    const sessionResult = await getRequestAuth()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await requireTeamAccessWithUser(teamId, sessionResult.user as SessionUser)
    const supabase = getSupabaseServer()

    const { data: rows, error } = await supabase
      .from("team_announcement_comments")
      .select("id, announcement_id, parent_id, user_id, author_name, author_role, body, created_at, updated_at")
      .eq("announcement_id", announcementId)
      .order("created_at", { ascending: true })
      .limit(200)

    if (error) {
      console.error("[GET comments]", error)
      return NextResponse.json({ error: "Failed to load comments" }, { status: 500 })
    }

    const all: CommentRow[] = rows ?? []

    // Nest replies under their parent
    const topLevel: CommentWithReplies[] = all
      .filter((c) => !c.parent_id)
      .map((c) => ({
        ...c,
        replies: all.filter((r) => r.parent_id === c.id),
      }))

    return NextResponse.json({ comments: topLevel, total: all.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized" || msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 })
    }
    console.error("[GET comments]", err)
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/team-announcements/[announcementId]/comments
 * Body: { body: string; parent_id?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string; announcementId: string }> }
) {
  try {
    const { teamId, announcementId } = await params
    if (!teamId || !announcementId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 })
    }

    const sessionResult = await getRequestAuth()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { membership } = await requireTeamAccessWithUser(teamId, sessionResult.user as SessionUser)
    const body = await request.json().catch(() => ({})) as { body?: string; parent_id?: string }

    const commentBody = typeof body.body === "string" ? body.body.trim() : ""
    if (!commentBody || commentBody.length > 2000) {
      return NextResponse.json({ error: "Comment must be 1–2000 characters" }, { status: 400 })
    }

    const parentId = typeof body.parent_id === "string" ? body.parent_id : null

    const supabase = getSupabaseServer()

    // Resolve author name
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", sessionResult.user.id)
      .maybeSingle()

    const authorName =
      (prof as { full_name?: string | null; email?: string | null } | null)?.full_name?.trim() ||
      (prof as { email?: string | null } | null)?.email?.trim() ||
      null

    const { data: inserted, error } = await supabase
      .from("team_announcement_comments")
      .insert({
        announcement_id: announcementId,
        parent_id: parentId,
        user_id: sessionResult.user.id,
        author_name: authorName,
        author_role: membershipRoleToAuthorRole(membership.role),
        body: commentBody,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[POST comments]", error)
      return NextResponse.json({ error: "Failed to post comment" }, { status: 500 })
    }

    return NextResponse.json({ comment: { ...inserted, replies: [] } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized" || msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 })
    }
    console.error("[POST comments]", err)
    return NextResponse.json({ error: "Failed to post comment" }, { status: 500 })
  }
}
