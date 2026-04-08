import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { revalidateTeamRosterDerivedCaches } from "@/lib/cache/lightweight-get-cache"
import { linkPendingPlayerToRosterRow, approvePendingPlayer, markPlayerInactive } from "@/lib/players/roster-claim-review-actions"

/**
 * GET /api/roster/claim-review?teamId=
 * Roster claim queues for coaches: unclaimed coach rows, self-reg pending review, claimed with accounts.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")
    const supabase = getSupabaseServer()

    const { data: rows, error } = await supabase
      .from("players")
      .select(
        "id, first_name, last_name, jersey_number, position_group, graduation_year, user_id, email, claim_status, self_registered, created_source, status, claimed_at, created_at"
      )
      .eq("team_id", teamId)
      .order("last_name", { ascending: true })

    if (error) {
      console.error("[GET /api/roster/claim-review]", error.message)
      return NextResponse.json({ error: "Failed to load roster review data" }, { status: 500 })
    }

    const list = rows ?? []
    const unclaimed = list.filter(
      (p) => !p.user_id && p.claim_status === "unclaimed" && p.status === "active" && !p.self_registered
    )
    const pendingReview = list.filter(
      (p) => p.user_id && p.self_registered && p.claim_status === "pending_review" && p.status === "active"
    )
    const claimed = list.filter((p) => p.user_id && p.claim_status === "claimed" && p.status === "active")

    const duplicateHints: { pendingId: string; rosterId: string; label: string }[] = []
    const norm = (s: string) => s.trim().toLowerCase()
    for (const pr of pendingReview) {
      const match = unclaimed.find(
        (u) =>
          norm(u.first_name) === norm(pr.first_name) && norm(u.last_name) === norm(pr.last_name)
      )
      if (match) {
        duplicateHints.push({
          pendingId: pr.id as string,
          rosterId: match.id as string,
          label: "Same name as an unclaimed roster spot",
        })
      }
    }

    return NextResponse.json({
      unclaimed,
      pendingReview,
      claimed,
      duplicateHints,
    })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[GET /api/roster/claim-review]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/roster/claim-review
 * Actions: approve | link | dismiss
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      teamId?: string
      action?: string
      playerId?: string
      pendingPlayerId?: string
      rosterPlayerId?: string
    }

    const teamId = typeof body.teamId === "string" ? body.teamId.trim() : ""
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")
    const supabase = getSupabaseServer()
    const coachId = session.user.id

    if (body.action === "approve") {
      const playerId = typeof body.playerId === "string" ? body.playerId.trim() : ""
      if (!playerId) return NextResponse.json({ error: "playerId is required" }, { status: 400 })
      const r = await approvePendingPlayer(supabase, { teamId, playerId, coachUserId: coachId })
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
      revalidateTeamRosterDerivedCaches(teamId)
      return NextResponse.json({ success: true })
    }

    if (body.action === "link") {
      const pendingPlayerId = typeof body.pendingPlayerId === "string" ? body.pendingPlayerId.trim() : ""
      const rosterPlayerId = typeof body.rosterPlayerId === "string" ? body.rosterPlayerId.trim() : ""
      if (!pendingPlayerId || !rosterPlayerId) {
        return NextResponse.json({ error: "pendingPlayerId and rosterPlayerId are required" }, { status: 400 })
      }
      const r = await linkPendingPlayerToRosterRow(supabase, {
        teamId,
        pendingPlayerId,
        rosterPlayerId,
        coachUserId: coachId,
      })
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
      revalidateTeamRosterDerivedCaches(teamId)
      return NextResponse.json({ success: true })
    }

    if (body.action === "dismiss") {
      const playerId = typeof body.playerId === "string" ? body.playerId.trim() : ""
      if (!playerId) return NextResponse.json({ error: "playerId is required" }, { status: 400 })
      const r = await markPlayerInactive(supabase, { teamId, playerId, coachUserId: coachId })
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
      revalidateTeamRosterDerivedCaches(teamId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[POST /api/roster/claim-review]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
