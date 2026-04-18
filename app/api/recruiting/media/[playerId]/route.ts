import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getRecruitingProfileByPlayerIdOrSlug } from "@/lib/recruiting/profile-resolver"
import { loadRecruitingFilmPayload } from "@/lib/recruiting/recruiting-media"

export const runtime = "nodejs"

/**
 * GET /api/recruiting/media/[playerId]
 * Recruiter-visible film payload (external links + non-private Braik media) for a player.
 * Only returned when recruiting_visibility is true.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  try {
    const { playerId } = await params
    if (!playerId) {
      return NextResponse.json({ error: "playerId required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const profile = await getRecruitingProfileByPlayerIdOrSlug(supabase, playerId, { requireVisible: true })
    if (!profile) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const film = await loadRecruitingFilmPayload(supabase, profile.playerId, profile.teamId)
    return NextResponse.json({ film })
  } catch (e) {
    console.error("[GET /api/recruiting/media/[playerId]]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
