import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { ensureRecruiterAccount } from "@/lib/recruiting/recruiter-account"

/**
 * POST /api/recruiting/save-player
 * Body: { playerId: string }
 * Add a player to the recruiter's saved list. Requires recruiter account.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureRecruiterAccount(getSupabaseServer(), session.user.id)

    const body = (await request.json()) as { playerId?: string }
    const playerId = body?.playerId
    if (!playerId || typeof playerId !== "string") {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { error } = await supabase.from("recruiter_saved_players").upsert(
      { recruiter_user_id: session.user.id, player_id: playerId },
      { onConflict: "recruiter_user_id,player_id" }
    )

    if (error) {
      console.error("[POST /api/recruiting/save-player]", error)
      return NextResponse.json({ error: "Failed to save player" }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[POST /api/recruiting/save-player]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
