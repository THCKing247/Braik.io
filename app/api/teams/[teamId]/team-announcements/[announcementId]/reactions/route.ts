import { NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { revalidateTeamAnnouncements } from "@/lib/cache/lightweight-get-cache"
import type { SessionUser } from "@/lib/auth/server-auth"

const VALID_EMOJIS = ["🔥", "💪", "❤️", "👍", "👀"] as const
const STAFF_ROLES = ["head_coach", "assistant_coach", "athletic_director", "school_admin"]

function isStaffRole(role: string) {
  return STAFF_ROLES.includes(role.toLowerCase().replace(/-/g, "_"))
}

function membershipRoleToUserRole(role: string): string {
  const r = role.toLowerCase().replace(/-/g, "_")
  if (r === "player") return "player"
  if (r === "parent") return "parent"
  return r
}

/**
 * GET /api/teams/[teamId]/team-announcements/[announcementId]/reactions
 * Returns aggregate counts, caller's own reactions, and (for staff) full reactor list.
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

    // Aggregate counts from view
    const { data: countRows } = await supabase
      .from("team_announcement_reaction_counts")
      .select("emoji, total_count, player_count, parent_count, staff_count")
      .eq("announcement_id", announcementId)

    // Caller's own emojis
    const { data: myRows } = await supabase
      .from("team_announcement_reactions")
      .select("emoji")
      .eq("announcement_id", announcementId)
      .eq("user_id", sessionResult.user.id)

    const mine: string[] = (myRows ?? []).map((r: { emoji: string }) => r.emoji)

    // Reactors list — staff only
    let reactors: { user_id: string; full_name: string | null; role: string; emoji: string; created_at: string }[] = []
    if (isStaffRole(membership.role)) {
      const { data: reactorRows } = await supabase
        .from("team_announcement_reactions")
        .select("user_id, emoji, created_at, user_role, profiles(full_name)")
        .eq("announcement_id", announcementId)
        .order("created_at", { ascending: false })
        .limit(50)

      reactors = (reactorRows ?? []).map((r: { user_id: string; emoji: string; created_at: string; user_role: string; profiles: { full_name: string | null }[] | { full_name: string | null } | null }) => {
        const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        return {
          user_id: r.user_id,
          full_name: prof?.full_name ?? null,
          role: r.user_role,
          emoji: r.emoji,
          created_at: r.created_at,
        }
      })
    }

    return NextResponse.json({
      counts: countRows ?? [],
      mine,
      reactors,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized" || msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 })
    }
    console.error("[GET reactions]", err)
    return NextResponse.json({ error: "Failed to load reactions" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/team-announcements/[announcementId]/reactions
 * Body: { emoji: string; action: "add" | "remove" }
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
    const body = await request.json().catch(() => ({})) as { emoji?: string; action?: string }
    const { emoji, action } = body

    if (!emoji || !VALID_EMOJIS.includes(emoji as typeof VALID_EMOJIS[number])) {
      return NextResponse.json({ error: "Invalid emoji" }, { status: 400 })
    }
    if (action !== "add" && action !== "remove") {
      return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const userId = sessionResult.user.id
    const userRole = membershipRoleToUserRole(membership.role)

    if (action === "add") {
      await supabase
        .from("team_announcement_reactions")
        .upsert(
          { announcement_id: announcementId, user_id: userId, user_role: userRole, emoji },
          { onConflict: "announcement_id,user_id,emoji", ignoreDuplicates: true }
        )
    } else {
      await supabase
        .from("team_announcement_reactions")
        .delete()
        .eq("announcement_id", announcementId)
        .eq("user_id", userId)
        .eq("emoji", emoji)
    }

    revalidateTeamAnnouncements(teamId)

    // Return fresh counts + mine
    const [{ data: countRows }, { data: myRows }] = await Promise.all([
      supabase
        .from("team_announcement_reaction_counts")
        .select("emoji, total_count, player_count, parent_count, staff_count")
        .eq("announcement_id", announcementId),
      supabase
        .from("team_announcement_reactions")
        .select("emoji")
        .eq("announcement_id", announcementId)
        .eq("user_id", userId),
    ])

    return NextResponse.json({
      counts: countRows ?? [],
      mine: (myRows ?? []).map((r: { emoji: string }) => r.emoji),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg === "Unauthorized" || msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: msg === "Unauthorized" ? 401 : 403 })
    }
    console.error("[POST reactions]", err)
    return NextResponse.json({ error: "Failed to update reaction" }, { status: 500 })
  }
}
