import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

/**
 * GET /api/teams/[teamId]
 * Returns public team summary (name, slogan, logoUrl) for display. Requires team access.
 * Query `scope=meta` returns only id + program_id (smaller payload for roster/program gating after roster loads).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()
    const scope = new URL(request.url).searchParams.get("scope")

    if (scope === "meta") {
      const { data, error } = await supabase.from("teams").select("id, program_id").eq("id", teamId).single()
      if (error || !data) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }
      return NextResponse.json({
        id: data.id,
        programId: (data as { program_id?: string | null }).program_id ?? null,
      })
    }

    const { data, error } = await supabase
      .from("teams")
      .select("id, name, slogan, sport, season_name, logo_url, program_id, team_level")
      .eq("id", teamId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    return NextResponse.json({
      id: data.id,
      name: data.name ?? "",
      slogan: data.slogan ?? null,
      sport: data.sport ?? "football",
      seasonName: data.season_name ?? "",
      logoUrl: data.logo_url ?? null,
      programId: (data as { program_id?: string }).program_id ?? null,
      teamLevel: (data as { team_level?: string }).team_level ?? null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load team"
    if (String(message).includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/[teamId]]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/teams/[teamId]
 * Update team identity: name, slogan, logo_url.
 * Requires team manage permission (HEAD_COACH or SCHOOL_ADMIN).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage")

    const body = await request.json().catch(() => ({}))
    const { name, slogan, logoUrl } = body as {
      name?: string
      slogan?: string | null
      logoUrl?: string | null
    }

    const supabase = getSupabaseServer()

    const updates: Record<string, unknown> = {}
    if (typeof name === "string") updates.name = name.trim() || null
    if (slogan !== undefined) updates.slogan = slogan === "" ? null : slogan
    if (logoUrl !== undefined) updates.logo_url = logoUrl === "" ? null : logoUrl

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("teams")
      .update(updates)
      .eq("id", teamId)
      .select("id, name, slogan, sport, season_name, logo_url")
      .single()

    if (error) {
      console.error("[PATCH /api/teams/[teamId]]", error)
      return NextResponse.json(
        { error: error.message || "Failed to update team" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: data.id,
      name: data.name ?? "",
      slogan: data.slogan ?? null,
      sport: data.sport ?? "football",
      seasonName: data.season_name ?? "",
      logoUrl: data.logo_url ?? null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update team"
    if (String(message).includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[PATCH /api/teams/[teamId]]", error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
