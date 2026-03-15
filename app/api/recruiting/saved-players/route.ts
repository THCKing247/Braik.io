import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { ensureRecruiterAccount } from "@/lib/recruiting/recruiter-account"

/**
 * GET /api/recruiting/saved-players
 * List players saved by the current recruiter. Requires recruiter account.
 */
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureRecruiterAccount(getSupabaseServer(), session.user.id)

    const supabase = getSupabaseServer()
    const { data: saved, error } = await supabase
      .from("recruiter_saved_players")
      .select("player_id, saved_at")
      .eq("recruiter_user_id", session.user.id)
      .order("saved_at", { ascending: false })

    if (error) {
      console.error("[GET /api/recruiting/saved-players]", error)
      return NextResponse.json({ error: "Failed to load saved players" }, { status: 500 })
    }

    const playerIds = (saved ?? []).map((s) => s.player_id)
    if (playerIds.length === 0) {
      return NextResponse.json({ saved: [] })
    }

    const { data: profiles } = await supabase
      .from("player_recruiting_profiles")
      .select("player_id, slug, recruiting_visibility")
      .in("player_id", playerIds)
    const profileByPlayer = new Map((profiles ?? []).map((p) => [p.player_id, p]))

    const { data: players } = await supabase
      .from("players")
      .select("id, first_name, last_name, position_group")
      .in("id", playerIds)

    const savedList = (saved ?? []).map((s) => {
      const p = (players ?? []).find((x) => x.id === s.player_id)
      const prof = profileByPlayer.get(s.player_id)
      return {
        playerId: s.player_id,
        savedAt: s.saved_at,
        slug: (prof as { slug?: string } | undefined)?.slug ?? null,
        firstName: (p as { first_name?: string })?.first_name ?? "",
        lastName: (p as { last_name?: string })?.last_name ?? "",
        positionGroup: (p as { position_group?: string })?.position_group ?? null,
        recruitingVisibility: (prof as { recruiting_visibility?: boolean })?.recruiting_visibility ?? false,
      }
    })

    return NextResponse.json({ saved: savedList })
  } catch (err) {
    console.error("[GET /api/recruiting/saved-players]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
