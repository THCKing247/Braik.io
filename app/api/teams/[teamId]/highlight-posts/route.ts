import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { applyRefreshedSessionCookies, type SessionUser } from "@/lib/auth/server-auth"
import { MembershipLookupError, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { ROLES } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { revalidateTeamHighlightPosts } from "@/lib/cache/lightweight-get-cache"
import type { TeamHighlightPostRow } from "@/lib/team-highlight-posts/types"

export const runtime = "nodejs"

/**
 * GET /api/teams/[teamId]/highlight-posts
 * Team members read player-submitted highlight posts for the feed.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const sessionResult = await getRequestAuth()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await requireTeamAccessWithUser(teamId, sessionResult.user as SessionUser)

    const supabase = getSupabaseServer()
    const { data: rows, error } = await supabase
      .from("team_highlight_posts")
      .select("id, team_id, author_id, author_name, title, body, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      console.error("[GET highlight-posts]", error)
      return NextResponse.json({ error: "Failed to load highlights" }, { status: 500 })
    }

    const res = NextResponse.json({ posts: (rows ?? []) as TeamHighlightPostRow[] })
    if (sessionResult.refreshedSession) {
      applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    }
    return res
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify access" }, { status: 500 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[GET highlight-posts]", err)
    return NextResponse.json({ error: "Failed to load highlights" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/highlight-posts
 * Players only — share a highlight to the team feed.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const sessionResult = await getRequestAuth()
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { membership } = await requireTeamAccessWithUser(teamId, sessionResult.user as SessionUser)
    if (membership.role !== ROLES.PLAYER) {
      return NextResponse.json({ error: "Only players can post highlights" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const messageBody = typeof body.body === "string" ? body.body.trim() : ""
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }
    if (title.length > 200) {
      return NextResponse.json({ error: "Title must be 200 characters or less" }, { status: 400 })
    }
    if (messageBody.length > 5000) {
      return NextResponse.json({ error: "Body must be 5000 characters or less" }, { status: 400 })
    }

    const userId = sessionResult.user.id
    const supabase = getSupabaseServer()

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle()

    const author_name =
      (prof as { full_name?: string; email?: string } | null)?.full_name?.trim() ||
      (prof as { email?: string } | null)?.email?.trim() ||
      null

    const { data: inserted, error } = await supabase
      .from("team_highlight_posts")
      .insert({
        team_id: teamId,
        author_id: userId,
        author_name,
        title: title.slice(0, 200),
        body: messageBody.slice(0, 5000),
      })
      .select()
      .single()

    if (error || !inserted) {
      console.error("[POST highlight-posts]", error)
      return NextResponse.json({ error: "Failed to post highlight" }, { status: 500 })
    }

    revalidateTeamHighlightPosts(teamId)

    const res = NextResponse.json(inserted as TeamHighlightPostRow)
    if (sessionResult.refreshedSession) {
      applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    }
    return res
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify access" }, { status: 500 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[POST highlight-posts]", err)
    return NextResponse.json({ error: "Failed to post highlight" }, { status: 500 })
  }
}
