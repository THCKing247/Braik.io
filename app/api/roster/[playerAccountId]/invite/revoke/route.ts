import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

/**
 * POST /api/roster/[playerAccountId]/invite/revoke
 * Revoke the pending player invite for this roster spot (sets status = 'revoked').
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ playerAccountId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerAccountId: segment } = await params
    if (!segment) {
      return NextResponse.json({ error: "playerAccountId route segment is required" }, { status: 400 })
    }

    const resolvedPlayerId = await resolveRosterApiPlayerUuid(null, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const { requireTeamPermission } = await import("@/lib/auth/rbac")
    const supabase = getSupabaseServer()

    const { data: player, error: fetchErr } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", resolvedPlayerId)
      .maybeSingle()

    if (fetchErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamPermission(player.team_id, "edit_roster")

    const { data: invite, error: inviteErr } = await supabase
      .from("player_invites")
      .select("id")
      .eq("player_id", resolvedPlayerId)
      .in("status", ["pending", "sent"])
      .maybeSingle()

    if (inviteErr) {
      console.error("[POST /api/roster/[playerAccountId]/invite/revoke]", inviteErr)
      return NextResponse.json({ error: "Failed to find invite" }, { status: 500 })
    }

    if (!invite) {
      return NextResponse.json({ error: "No pending invite to revoke." }, { status: 400 })
    }

    const { error: updateErr } = await supabase
      .from("player_invites")
      .update({ status: "revoked" })
      .eq("id", (invite as { id: string }).id)

    if (updateErr) {
      console.error("[POST /api/roster/[playerAccountId]/invite/revoke]", updateErr)
      return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to revoke invite" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Insufficient")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/roster/[playerAccountId]/invite/revoke]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
