import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { computeReadiness, resolveRequiredDocCategoriesFromStored } from "@/lib/readiness"
import { activeDocumentCategoriesForReadiness } from "@/lib/readiness-documents"
import { resolveRosterApiPlayerUuid } from "@/lib/roster/resolve-roster-route-player-api"

/**
 * GET /api/roster/[playerId]/readiness?teamId=xxx
 * Returns a simple readiness/compliance summary derived from profile, documents, and equipment.
 * Coach: any player. Player: own profile only.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId: segment } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!segment || !teamId) {
      return NextResponse.json({ error: "playerId and teamId are required" }, { status: 400 })
    }

    const resolvedPlayerId = await resolveRosterApiPlayerUuid(teamId, segment)
    if (!resolvedPlayerId) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select(
        "id, team_id, user_id, first_name, last_name, email, player_phone, parent_guardian_contact, eligibility_status"
      )
      .eq("id", resolvedPlayerId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const membership = await getUserMembership(teamId)
    const isCoach = membership ? canEditRoster(membership.role) : false
    const isOwn = (player as { user_id: string | null }).user_id === session.user.id
    if (!isCoach && !isOwn) {
      return NextResponse.json({ error: "You can only view your own readiness." }, { status: 403 })
    }

    const row = player as {
      first_name: string | null
      last_name: string | null
      email: string | null
      player_phone: string | null
      parent_guardian_contact: string | null
      eligibility_status: string | null
    }

    const hasName =
      Boolean(row.first_name?.trim()) && Boolean(row.last_name?.trim())
    const hasContact =
      Boolean(row.player_phone?.trim()) ||
      Boolean(row.email?.trim()) ||
      Boolean(row.parent_guardian_contact?.trim())

    const { data: docs } = await supabase
      .from("player_documents")
      .select("category, document_type, deleted_at, expires_at")
      .eq("player_id", resolvedPlayerId)
      .eq("team_id", teamId)
    const categories = activeDocumentCategoriesForReadiness(docs ?? [])

    const { count } = await supabase
      .from("inventory_items")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("assigned_to_player_id", resolvedPlayerId)

    const { data: teamMeta } = await supabase
      .from("teams")
      .select("roster_template")
      .eq("id", teamId)
      .maybeSingle()
    const dr = (
      teamMeta as { roster_template?: { documentReadinessRequired?: Record<string, boolean> } } | null
    )?.roster_template?.documentReadinessRequired
    const requiredDocCategories = resolveRequiredDocCategoriesFromStored(dr)

    const result = computeReadiness(
      {
        hasName,
        hasContact,
        documentCategories: categories,
        eligibilityStatus: row.eligibility_status ?? null,
        assignedEquipmentCount: count ?? 0,
      },
      { requiredDocCategories }
    )

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/roster/.../readiness]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
