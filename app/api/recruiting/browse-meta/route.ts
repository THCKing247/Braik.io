import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getRecruitingBrowseMeta } from "@/lib/recruiting/search"

/**
 * GET /api/recruiting/browse-meta
 * Public: teams, positions, and graduation years available in the public recruiting browser (listing-quality profiles only).
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer()
    const meta = await getRecruitingBrowseMeta(supabase)
    return NextResponse.json(meta)
  } catch (err) {
    console.error("[GET /api/recruiting/browse-meta]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
