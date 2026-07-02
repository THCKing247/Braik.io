import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { SessionUser } from "@/lib/auth/server-auth"

const STAFF_ROLES = ["head_coach", "assistant_coach", "athletic_director", "school_admin"]
function isStaffRole(role: string) {
  return STAFF_ROLES.includes(role.toLowerCase().replace(/-/g, "_"))
}

/**
 * POST /api/teams/[teamId]/team-announcements/[announcementId]/views
 * Mark the announcement as viewed by the caller. Idempotent.
 */
export async function POST(
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

    await supabase
      .from("team_announcement_views")
      .upsert(
        { announcement_id: announcementId, user_id: sessionResult.user.id },
        { onConflict: "announcement_id,user_id", ignoreDuplicates: true }
      )

    return NextResponse.json({ viewed: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized" || msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 })
    }
    // Silently fail for view tracking — don't break the feed
    console.warn("[POST views]", err)
    return NextResponse.json({ viewed: false })
  }
}

/**
 * GET /api/teams/[teamId]/team-announcements/[announcementId]/views
 * Returns total view count. For staff: also returns the viewer list.
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

    const { membership } = await requireTeamAccessWithUser(teamId, sessionResult.user as SessionUser)
    const supabase = getSupabaseServer()

    // Aggregate count
    const { data: countRow } = await supabase
      .from("team_announcement_view_counts")
      .select("total_views")
      .eq("announcement_id", announcementId)
      .maybeSingle()

    const count = (countRow as { total_views?: number } | null)?.total_views ?? 0

    // Viewer list — staff only
    let viewers: { user_id: string; full_name: string | null; role: string; viewed_at: string }[] = []
    if (isStaffRole(membership.role)) {
      const { data: viewRows } = await supabase
        .from("team_announcement_views")
        .select("user_id, viewed_at, profiles(full_name, role)")
        .eq("announcement_id", announcementId)
        .order("viewed_at", { ascending: false })
        .limit(100)

      viewers = (viewRows ?? []).map((v: { user_id: string; viewed_at: string; profiles: { full_name: string | null; role: string }[] | { full_name: string | null; role: string } | null }) => {
        const prof = Array.isArray(v.profiles) ? v.profiles[0] : v.profiles
        return {
          user_id: v.user_id,
          full_name: prof?.full_name ?? null,
          role: prof?.role ?? "player",
          viewed_at: v.viewed_at,
        }
      })
    }

    return NextResponse.json({ count, viewers })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized" || msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 })
    }
    console.error("[GET views]", err)
    return NextResponse.json({ error: "Failed to load views" }, { status: 500 })
  }
}
