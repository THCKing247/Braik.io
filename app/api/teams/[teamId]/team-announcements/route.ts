import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireAuth, requireTeamAccessWithUser, requireTeamPermission } from "@/lib/auth/rbac"
import {
  sortTeamAnnouncements,
  userCanViewTeamAnnouncement,
  type TeamAnnouncementAudience,
} from "@/lib/team-announcements"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"

const AUDIENCES: TeamAnnouncementAudience[] = ["all", "staff", "players", "parents"]

function parseAudience(v: unknown): TeamAnnouncementAudience {
  const s = typeof v === "string" ? v : "all"
  return AUDIENCES.includes(s as TeamAnnouncementAudience) ? (s as TeamAnnouncementAudience) : "all"
}

/**
 * GET /api/teams/[teamId]/team-announcements
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

    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { membership } = await requireTeamAccessWithUser(teamId, session.user)
    const supabase = getSupabaseServer()

    const { data: rows, error } = await supabase
      .from("team_announcements")
      .select(
        "id, team_id, title, body, author_id, author_name, created_at, updated_at, is_pinned, audience, send_notification"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[GET team-announcements]", error)
      return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 })
    }

    const list = (rows || []).filter((r) =>
      userCanViewTeamAnnouncement(membership.role, String((r as { audience?: string }).audience || "all"))
    )
    const announcements = sortTeamAnnouncements(list as Parameters<typeof sortTeamAnnouncements>[0])

    return NextResponse.json({ announcements })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[GET team-announcements]", err)
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/team-announcements
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

    const user = await requireAuth()
    await requireTeamPermission(teamId, "post_announcements")
    const body = await request.json().catch(() => ({}))
    const title = typeof body.title === "string" ? body.title.trim() : ""
    const messageBody = typeof body.body === "string" ? body.body.trim() : ""
    if (!title || !messageBody) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 })
    }

    const audience = parseAudience(body.audience)
    const is_pinned = Boolean(body.is_pinned)
    const send_notification = Boolean(body.send_notification)

    const supabase = getSupabaseServer()
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle()

    const author_name =
      (prof as { full_name?: string; email?: string } | null)?.full_name?.trim() ||
      (prof as { email?: string } | null)?.email?.trim() ||
      null

    const { data: inserted, error } = await supabase
      .from("team_announcements")
      .insert({
        team_id: teamId,
        title: title.slice(0, 500),
        body: messageBody.slice(0, 20000),
        author_id: user.id,
        author_name,
        audience,
        is_pinned,
        send_notification,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error("[POST team-announcements]", error)
      return NextResponse.json({ error: "Failed to post announcement" }, { status: 500 })
    }

    trackProductEventServer({
      eventName: BRAIK_EVENTS.announcements.posted,
      userId: user.id,
      teamId,
      role: user.role ?? null,
      metadata: {
        announcement_id: inserted?.id ?? null,
        audience,
        pinned: is_pinned,
        send_notification,
      },
    })

    return NextResponse.json(inserted)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[POST team-announcements]", err)
    return NextResponse.json({ error: "Failed to post announcement" }, { status: 500 })
  }
}
