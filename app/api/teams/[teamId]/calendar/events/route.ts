import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/teams/[teamId]/calendar/events
 * Returns calendar events for the team. Shape matches ScheduleManager Event.
 */
export async function GET(
  _request: Request,
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

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)
    const { data: rows, error } = await supabase
      .from("events")
      .select("id, event_type, title, description, start, end, location, visibility, created_by, created_at")
      .eq("team_id", teamId)
      .order("start", { ascending: true })

    if (error) {
      console.error("[GET /api/teams/.../calendar/events]", error.message, error)
      return NextResponse.json(
        { error: "Failed to load events" },
        { status: 500 }
      )
    }

    const creatorIds = [...new Set((rows ?? []).map((r) => r.created_by))]
    let creatorMap = new Map<string, { name: string | null; email: string }>()
    if (creatorIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, name, email")
        .in("id", creatorIds)
      creatorMap = new Map((users ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }]))
    }

    const visibilityToAudience: Record<string, string> = {
      TEAM: "players",
      PARENTS_AND_TEAM: "all",
      COACHES_ONLY: "staff",
      CUSTOM: "all",
    }

    const events = (rows ?? []).map((e) => {
      const creator = creatorMap.get(e.created_by)
      return {
        id: e.id,
        type: e.event_type ?? "CUSTOM",
        title: e.title ?? "",
        start: e.start,
        end: e.end,
        location: e.location ?? null,
        notes: e.description ?? null,
        audience: visibilityToAudience[e.visibility ?? "TEAM"] ?? "players",
        creator: creator ? { name: creator.name, email: creator.email } : { name: null, email: "" },
        rsvps: [] as Array<{ player: { firstName: string; lastName: string }; status: string }>,
        linkedDocuments: [] as Array<{
          document: { id: string; title: string; fileName: string; fileUrl: string; fileSize: number | null; mimeType: string | null }
        }>,
      }
    })

    return NextResponse.json(events)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../calendar/events]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST - create event; use POST /api/events instead (already implemented).
 */
export async function POST() {
  return NextResponse.json(
    { error: "Use POST /api/events to create events." },
    { status: 400 }
  )
}
