import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"

export type EngagementHint = {
  id: string
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
}

const COACH_ROLES = new Set(["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"])

/**
 * GET /api/engagement/hints?teamId= — lightweight, privacy-safe setup nudges for coaches.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role ?? ""
    if (!COACH_ROLES.has(role)) {
      return NextResponse.json({ hints: [] as EngagementHint[] })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)
    const supabase = getSupabaseServer()

    const hints: EngagementHint[] = []

    const { count: playerCount } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)

    if ((playerCount ?? 0) === 0) {
      hints.push({
        id: "first_roster",
        title: "Add your first players",
        description: "A roster unlocks depth charts, messaging, and health tracking for this team.",
        ctaLabel: "Open roster",
        ctaHref: `/dashboard/roster?teamId=${encodeURIComponent(teamId)}`,
      })
    }

    const { count: playbookCount } = await supabase
      .from("playbooks")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)

    if ((playbookCount ?? 0) === 0) {
      hints.push({
        id: "first_playbook",
        title: "Create a playbook",
        description: "Capture your installs and call sheets in one place.",
        ctaLabel: "Playbooks",
        ctaHref: `/dashboard/playbooks?teamId=${encodeURIComponent(teamId)}`,
      })
    }

    const { count: openInjuryCount } = await supabase
      .from("player_injuries")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "active")

    if ((openInjuryCount ?? 0) > 0) {
      hints.push({
        id: "open_injuries",
        title: "You have active injuries",
        description: "Resolve or update return expectations so staff stays aligned.",
        ctaLabel: "Health",
        ctaHref: `/dashboard/health?teamId=${encodeURIComponent(teamId)}`,
      })
    }

    const { count: annCount } = await supabase
      .from("team_announcements")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)

    if ((annCount ?? 0) === 0 && (playerCount ?? 0) > 0) {
      hints.push({
        id: "first_announcement",
        title: "Post a team announcement",
        description: "Share schedules or reminders—parents and players see updates here.",
        ctaLabel: "Messaging & announcements",
        ctaHref: `/dashboard/messages?teamId=${encodeURIComponent(teamId)}`,
      })
    }

    return NextResponse.json({ hints })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify access" }, { status: 500 })
    }
    const msg = err instanceof Error ? err.message : "Error"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    console.error("[GET /api/engagement/hints]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
