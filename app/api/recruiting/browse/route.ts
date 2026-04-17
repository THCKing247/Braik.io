import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { searchRecruitingProfiles } from "@/lib/recruiting/search"

/**
 * GET /api/recruiting/browse
 * Public search of recruiting-visible players with listing-quality filtering (film, URLs, bio, or measurables).
 * Query: teamId, position, graduationYear, state, teamLevel, heightFeetMin, weightLbsMin, fortyTimeMax, gpaMin, playbookMasteryMin, limit, offset
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = {
      position: searchParams.get("position") || undefined,
      graduationYear: searchParams.get("graduationYear") ? parseInt(searchParams.get("graduationYear")!, 10) : undefined,
      teamId: searchParams.get("teamId") || undefined,
      state: searchParams.get("state") || undefined,
      teamLevel: searchParams.get("teamLevel") || undefined,
      heightFeetMin: searchParams.get("heightFeetMin") ? parseInt(searchParams.get("heightFeetMin")!, 10) : undefined,
      heightInchesMin: searchParams.get("heightInchesMin") ? parseInt(searchParams.get("heightInchesMin")!, 10) : undefined,
      weightLbsMin: searchParams.get("weightLbsMin") ? parseInt(searchParams.get("weightLbsMin")!, 10) : undefined,
      fortyTimeMax: searchParams.get("fortyTimeMax") ? parseFloat(searchParams.get("fortyTimeMax")!) : undefined,
      gpaMin: searchParams.get("gpaMin") ? parseFloat(searchParams.get("gpaMin")!) : undefined,
      playbookMasteryMin: searchParams.get("playbookMasteryMin") ? parseInt(searchParams.get("playbookMasteryMin")!, 10) : undefined,
      recruitingVisibilityOnly: true,
      requireListingQuality: true,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0,
    }

    const supabase = getSupabaseServer()
    const { results, total } = await searchRecruitingProfiles(supabase, filters)
    return NextResponse.json({ results, total })
  } catch (err) {
    console.error("[GET /api/recruiting/browse]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
