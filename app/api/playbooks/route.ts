import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/playbooks?teamId=xxx
 * Returns playbooks for the team.
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

    const { data: playbooks, error } = await supabase
      .from("playbooks")
      .select("id, team_id, name, visibility, created_at, updated_at")
      .eq("team_id", teamId)
      .order("name", { ascending: true })

    if (error) {
      console.error("[GET /api/playbooks]", error)
      return NextResponse.json({ error: "Failed to load playbooks" }, { status: 500 })
    }

    const formatted = (playbooks ?? []).map((p) => ({
      id: p.id,
      teamId: p.team_id,
      name: p.name,
      visibility: p.visibility ?? "team",
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }))

    return NextResponse.json(formatted)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/playbooks]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load playbooks" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/playbooks
 * Creates a new playbook.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as { teamId?: string; name?: string; visibility?: string }

    const { teamId, name, visibility } = body

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    const { data: playbook, error: insertError } = await supabase
      .from("playbooks")
      .insert({
        team_id: teamId,
        name: name.trim(),
        visibility: visibility && ["team", "offense", "defense", "special_teams"].includes(visibility) ? visibility : "team",
        nodes: {},
        root_by_side: {},
      })
      .select("id, team_id, name, visibility, created_at, updated_at")
      .single()

    if (insertError || !playbook) {
      console.error("[POST /api/playbooks]", insertError)
      return NextResponse.json({ error: "Failed to create playbook" }, { status: 500 })
    }

    return NextResponse.json({
      id: playbook.id,
      teamId: playbook.team_id,
      name: playbook.name,
      visibility: playbook.visibility ?? "team",
      createdAt: playbook.created_at,
      updatedAt: playbook.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[POST /api/playbooks]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to create playbook" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
