import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, getUserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"

/**
 * GET /api/roster/[playerId]/guardians?teamId=xxx
 * Returns guardians linked to this player (guardian_links + guardians).
 * Coach: any player. Player: own profile only. Future: guardian can see own link.
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

    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!playerId || !teamId) {
      return NextResponse.json({ error: "playerId and teamId are required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("id", playerId)
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
      return NextResponse.json({ error: "You can only view guardians for your own profile." }, { status: 403 })
    }

    const { data: links, error: linksErr } = await supabase
      .from("guardian_links")
      .select("id, guardian_id, player_id, relationship, verified")
      .eq("player_id", playerId)

    if (linksErr) {
      console.error("[GET /api/roster/.../guardians]", linksErr.message)
      return NextResponse.json({ error: "Failed to load guardians" }, { status: 500 })
    }

    if (!links?.length) {
      return NextResponse.json([])
    }

    const guardianIds = [...new Set((links ?? []).map((l) => (l as { guardian_id: string }).guardian_id))]
    const { data: guardians } = await supabase
      .from("guardians")
      .select("id, user_id, first_name, last_name, email, phone, relationship")
      .in("id", guardianIds)

    const userIds = [...new Set((guardians ?? []).map((g) => (g as { user_id: string }).user_id))]
    let userMap = new Map<string, { name: string | null; email: string }>()
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", userIds)
      userMap = new Map(
        (users ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }])
      )
    }

    const guardianById = new Map((guardians ?? []).map((g) => [(g as { id: string }).id, g]))
    const result = (links ?? []).map((link) => {
      const g = guardianById.get((link as { guardian_id: string }).guardian_id) as {
        id: string
        user_id: string | null
        first_name: string | null
        last_name: string | null
        email: string | null
        phone: string | null
        relationship: string | null
      } | undefined
      const user = g?.user_id ? userMap.get(g.user_id) : null
      const name = g
        ? [g.first_name, g.last_name].filter(Boolean).join(" ") || user?.name || "Guardian"
        : "Guardian"
      return {
        linkId: (link as { id: string }).id,
        guardianId: (link as { guardian_id: string }).guardian_id,
        relationship: (link as { relationship?: string }).relationship ?? g?.relationship ?? null,
        verified: (link as { verified?: boolean }).verified ?? false,
        name,
        email: g?.email ?? user?.email ?? null,
        phone: g?.phone ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/roster/.../guardians]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
