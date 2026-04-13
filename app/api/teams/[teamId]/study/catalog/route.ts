import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

const CATALOG_KINDS = ["playbook", "formation", "play", "install_script", "study_pack"] as const

/** Lightweight program material for the assignment builder. Use `?kind=playbook` (etc.) for one list only. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const kind = new URL(request.url).searchParams.get("kind")
    const supabase = getSupabaseServer()

    if (kind && (CATALOG_KINDS as readonly string[]).includes(kind)) {
      if (kind === "playbook") {
        const { data, error } = await supabase.from("playbooks").select("id,name").eq("team_id", teamId).order("name").limit(250)
        if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
        return NextResponse.json({ kind, items: data ?? [] })
      }
      if (kind === "formation") {
        const { data, error } = await supabase
          .from("formations")
          .select("id,name,side,playbook_id")
          .eq("team_id", teamId)
          .order("name")
          .limit(400)
        if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
        return NextResponse.json({ kind, items: data ?? [] })
      }
      if (kind === "play") {
        const { data, error } = await supabase
          .from("plays")
          .select("id,name,side,playbook_id")
          .eq("team_id", teamId)
          .order("updated_at", { ascending: false })
          .limit(400)
        if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
        return NextResponse.json({ kind, items: data ?? [] })
      }
      if (kind === "install_script") {
        const { data, error } = await supabase
          .from("install_scripts")
          .select("id,name,playbook_id")
          .eq("team_id", teamId)
          .order("name")
          .limit(200)
        if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
        return NextResponse.json({ kind, items: data ?? [] })
      }
      if (kind === "study_pack") {
        const { data, error } = await supabase.from("study_packs").select("id,title").eq("team_id", teamId).order("title").limit(200)
        if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
        return NextResponse.json({ kind, items: data ?? [] })
      }
    }

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
