import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { getPromotionCandidates } from "@/lib/program-intelligence/insights"

/**
 * GET /api/program-intelligence/promotions?programId=xxx&limit=5
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const programId = searchParams.get("programId")
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }
    await requireProgramCoach(programId)
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "5", 10) || 5, 20)
    const supabase = getSupabaseServer()
    const candidates = await getPromotionCandidates(supabase, programId, limit)
    return NextResponse.json({ candidates })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/program-intelligence/promotions]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
