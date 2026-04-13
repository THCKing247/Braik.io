import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/playbooks/summary?teamId=xxx
 * Browse/list payload: playbook rows with per-playbook formation and play counts (no canvas/template blobs).
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    const [playbooksRes, formationsRes, playsRes] = await Promise.all([
      supabase
        .from("playbooks")
        .select("id, team_id, name, visibility, created_at, updated_at")
        .eq("team_id", teamId)
        .order("name", { ascending: true }),
      supabase.from("formations").select("playbook_id").eq("team_id", teamId).not("playbook_id", "is", null),
      supabase.from("plays").select("playbook_id").eq("team_id", teamId).not("playbook_id", "is", null),
    ])

    if (playbooksRes.error) {
      console.error("[GET /api/playbooks/summary] playbooks", playbooksRes.error)
      return NextResponse.json({ error: "Failed to load playbooks" }, { status: 500 })
    }
    if (formationsRes.error) {
      console.error("[GET /api/playbooks/summary] formations", formationsRes.error)
      return NextResponse.json({ error: "Failed to load formation counts" }, { status: 500 })
    }
    if (playsRes.error) {
      console.error("[GET /api/playbooks/summary] plays", playsRes.error)
      return NextResponse.json({ error: "Failed to load play counts" }, { status: 500 })
    }

    const formationCountByPlaybook = new Map<string, number>()
    for (const row of formationsRes.data ?? []) {
      const pid = row.playbook_id as string
      if (!pid) continue
      formationCountByPlaybook.set(pid, (formationCountByPlaybook.get(pid) ?? 0) + 1)
    }

    const playCountByPlaybook = new Map<string, number>()
    for (const row of playsRes.data ?? []) {
      const pid = row.playbook_id as string
      if (!pid) continue
      playCountByPlaybook.set(pid, (playCountByPlaybook.get(pid) ?? 0) + 1)
    }

    const formatted = (playbooksRes.data ?? []).map((p) => ({
      id: p.id,
      teamId: p.team_id,
      name: p.name,
      visibility: p.visibility ?? "team",
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      formationCount: formationCountByPlaybook.get(p.id) ?? 0,
      playCount: playCountByPlaybook.get(p.id) ?? 0,
    }))

    return NextResponse.json(formatted)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/playbooks/summary]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load playbook summary" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
