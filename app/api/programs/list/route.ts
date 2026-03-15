import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * GET /api/programs/list
 * Returns programs the current user is a member of (program_members). Used for program selector (e.g. AD, coaches with multiple programs).
 */
export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = getSupabaseServer()
    const { data: members } = await supabase
      .from("program_members")
      .select("program_id")
      .eq("user_id", session.user.id)
      .eq("active", true)

    const programIds = [...new Set((members ?? []).map((m) => m.program_id))]
    if (programIds.length === 0) {
      return NextResponse.json({ programs: [] })
    }

    const { data: programs } = await supabase
      .from("programs")
      .select("id, program_name")
      .in("id", programIds)

    return NextResponse.json({
      programs: (programs ?? []).map((p) => ({
        id: p.id,
        programName: (p as { program_name?: string }).program_name ?? "",
      })),
    })
  } catch (err) {
    console.error("[GET /api/programs/list]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
