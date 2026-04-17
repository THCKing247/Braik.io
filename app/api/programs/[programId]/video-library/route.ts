import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramStaffAdmin, MembershipLookupError } from "@/lib/auth/rbac"

export const runtime = "nodejs"

/**
 * Aggregated game film index across all teams in a program (program / AD admin).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ programId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { programId } = await params
    await requireProgramStaffAdmin(programId)

    const supabase = getSupabaseServer()
    const { data: teams, error: tErr } = await supabase.from("teams").select("id, name").eq("program_id", programId)
    if (tErr) {
      return NextResponse.json({ error: tErr.message }, { status: 500 })
    }

    const teamIds = (teams ?? []).map((t: { id: string }) => t.id)
    const teamNameById = new Map<string, string | null>()
    for (const t of teams ?? []) {
      teamNameById.set((t as { id: string }).id, (t as { name?: string | null }).name ?? null)
    }

    if (teamIds.length === 0) {
      return NextResponse.json({ videos: [] })
    }

    const { data: videos, error: vErr } = await supabase
      .from("game_videos")
      .select("id, team_id, title, duration_seconds, file_size_bytes, upload_status, created_at")
      .in("team_id", teamIds)
      .eq("upload_status", "ready")
      .order("created_at", { ascending: false })
      .limit(300)

    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 })
    }

    const enriched = (videos ?? []).map((v: { team_id: string }) => ({
      ...v,
      teamName: teamNameById.get(v.team_id) ?? null,
    }))

    return NextResponse.json({ videos: enriched })
  } catch (e) {
    const msg = e instanceof Error ? e.message : ""
    if (e instanceof MembershipLookupError || msg.includes("Access denied")) {
      return NextResponse.json({ error: msg || "Forbidden" }, { status: 403 })
    }
    throw e
  }
}
