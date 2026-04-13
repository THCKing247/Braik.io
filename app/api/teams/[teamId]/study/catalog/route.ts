import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/** Lightweight program material ids for the assignment builder (fetch on demand, not on initial portal load). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const [playbooks, formations, plays, install_scripts, study_packs] = await Promise.all([
      supabase.from("playbooks").select("id,name").eq("team_id", teamId).order("name").limit(250),
      supabase.from("formations").select("id,name,side,playbook_id").eq("team_id", teamId).order("name").limit(400),
      supabase
        .from("plays")
        .select("id,name,side,playbook_id")
        .eq("team_id", teamId)
        .order("updated_at", { ascending: false })
        .limit(400),
      supabase.from("install_scripts").select("id,name,playbook_id").eq("team_id", teamId).order("name").limit(200),
      supabase.from("study_packs").select("id,title").eq("team_id", teamId).order("title").limit(200),
    ])

    return NextResponse.json({
      playbooks: playbooks.data ?? [],
      formations: formations.data ?? [],
      plays: plays.data ?? [],
      install_scripts: install_scripts.data ?? [],
      study_packs: study_packs.data ?? [],
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
