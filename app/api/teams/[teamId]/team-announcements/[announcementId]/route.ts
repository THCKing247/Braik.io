import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { userCanEditTeamAnnouncement, type TeamAnnouncementAudience } from "@/lib/team-announcements"
import { revalidateTeamAnnouncements, revalidateTeamEngagementHints } from "@/lib/cache/lightweight-get-cache"

const AUDIENCES: TeamAnnouncementAudience[] = ["all", "staff", "players", "parents"]

function parseAudience(v: unknown): TeamAnnouncementAudience | undefined {
  if (typeof v !== "string") return undefined
  return AUDIENCES.includes(v as TeamAnnouncementAudience) ? (v as TeamAnnouncementAudience) : undefined
}

/**
 * PATCH /api/teams/[teamId]/team-announcements/[announcementId]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; announcementId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, announcementId } = await params
    if (!teamId || !announcementId) {
      return NextResponse.json({ error: "teamId and announcementId required" }, { status: 400 })
    }

    const { user, membership } = await requireTeamAccess(teamId)
    const supabase = getSupabaseServer()

    const { data: row, error: fetchErr } = await supabase
      .from("team_announcements")
      .select("id, team_id, author_id")
      .eq("id", announcementId)
      .maybeSingle()

    if (fetchErr || !row) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    if ((row as { team_id: string }).team_id !== teamId) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 })
    }

    const authorId = (row as { author_id: string }).author_id
    if (!userCanEditTeamAnnouncement(user.id, membership.role, authorId)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (typeof body.title === "string") {
      const t = body.title.trim()
      if (!t) return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 })
      patch.title = t.slice(0, 500)
    }
    if (typeof body.body === "string") {
      const b = body.body.trim()
      if (!b) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 })
      patch.body = b.slice(0, 20000)
    }
    if (typeof body.is_pinned === "boolean") patch.is_pinned = body.is_pinned
    const aud = parseAudience(body.audience)
    if (aud !== undefined) patch.audience = aud
    if (typeof body.send_notification === "boolean") patch.send_notification = body.send_notification

    const { data: updated, error } = await supabase
      .from("team_announcements")
      .update(patch)
      .eq("id", announcementId)
      .select()
      .single()

    if (error) {
      console.error("[PATCH team-announcements]", error)
      return NextResponse.json({ error: "Failed to update" }, { status: 500 })
    }

    revalidateTeamAnnouncements(teamId)
    revalidateTeamEngagementHints(teamId)

    return NextResponse.json(updated)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[PATCH team-announcements]", err)
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 })
  }
}
