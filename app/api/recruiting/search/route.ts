import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { searchRecruitingProfiles } from "@/lib/recruiting/search"
import { ensureRecruiterAccount } from "@/lib/recruiting/recruiter-account"

/**
 * GET /api/recruiting/search
 * Search recruiting-visible players. Requires recruiter account (created on first use).
 * Query: position, graduationYear, state, teamLevel, heightFeetMin, weightLbsMin, fortyTimeMax, gpaMin, playbookMasteryMin, limit, offset
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await ensureRecruiterAccount(getSupabaseServer(), session.user.id)

    const { searchParams } = new URL(request.url)
    const filters = {
      position: searchParams.get("position") || undefined,
      graduationYear: searchParams.get("graduationYear") ? parseInt(searchParams.get("graduationYear")!, 10) : undefined,
      state: searchParams.get("state") || undefined,
      teamLevel: searchParams.get("teamLevel") || undefined,
      heightFeetMin: searchParams.get("heightFeetMin") ? parseInt(searchParams.get("heightFeetMin")!, 10) : undefined,
      heightInchesMin: searchParams.get("heightInchesMin") ? parseInt(searchParams.get("heightInchesMin")!, 10) : undefined,
      weightLbsMin: searchParams.get("weightLbsMin") ? parseInt(searchParams.get("weightLbsMin")!, 10) : undefined,
      fortyTimeMax: searchParams.get("fortyTimeMax") ? parseFloat(searchParams.get("fortyTimeMax")!) : undefined,
      gpaMin: searchParams.get("gpaMin") ? parseFloat(searchParams.get("gpaMin")!) : undefined,
      playbookMasteryMin: searchParams.get("playbookMasteryMin") ? parseInt(searchParams.get("playbookMasteryMin")!, 10) : undefined,
      recruitingVisibilityOnly: true,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20,
      offset: searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0,
    }

    const supabase = getSupabaseServer()
    const { results, total } = await searchRecruitingProfiles(supabase, filters)
    return NextResponse.json({ results, total })
  } catch (err) {
    console.error("[GET /api/recruiting/search]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
