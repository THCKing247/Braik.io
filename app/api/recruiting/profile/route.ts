import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getRecruitingProfileByPlayerIdOrSlug } from "@/lib/recruiting/profile-resolver"

/**
 * GET /api/recruiting/profile?playerId=xxx or ?slug=xxx
 * Returns public recruiting profile (only when recruiting_visibility = true).
 * No auth required for public view.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get("playerId")
    const slug = searchParams.get("slug")
    const idOrSlug = playerId ?? slug
    if (!idOrSlug) {
      return NextResponse.json({ error: "playerId or slug is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const profile = await getRecruitingProfileByPlayerIdOrSlug(supabase, idOrSlug, { requireVisible: true })
    if (!profile) {
      return NextResponse.json({ error: "Profile not found or not visible" }, { status: 404 })
    }
    return NextResponse.json(profile)
  } catch (err) {
    console.error("[GET /api/recruiting/profile]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
