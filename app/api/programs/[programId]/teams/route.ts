import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramTeamsListAccess } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

/**
 * GET /api/programs/[programId]/teams
 * List teams in the program (for promotion target dropdown, etc.).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }

    await requireProgramTeamsListAccess(programId)

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("teams")
      .select("id, name, team_level")
      .eq("program_id", programId)
      .order("team_level", { ascending: true })

    if (error) {
      console.error("[GET /api/programs/[programId]/teams]", error)
      return NextResponse.json({ error: "Failed to load teams" }, { status: 500 })
    }

    const teams = (data ?? []).map((t) => ({
      id: t.id,
      name: (t as { name?: string }).name ?? "",
      teamLevel: (t as { team_level?: string }).team_level ?? null,
    }))

    return NextResponse.json({ teams })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/programs/[programId]/teams]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
