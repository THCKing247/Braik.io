import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { getCallUpSuggestions } from "@/lib/program-intelligence/callup-suggestions"

/**
 * GET /api/programs/callup-suggestions?programId=xxx&position=QB
 * Returns top call-up suggestions for a position (JV/Freshman players ranked by readiness).
 * Coaches only.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const programId = searchParams.get("programId")
    const position = searchParams.get("position") ?? ""

    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }
    if (!position.trim()) {
      return NextResponse.json({ error: "position is required" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const supabase = getSupabaseServer()
    const suggestions = await getCallUpSuggestions(supabase, programId, position.trim(), 3)

    return NextResponse.json({ suggestions })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/programs/callup-suggestions]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
