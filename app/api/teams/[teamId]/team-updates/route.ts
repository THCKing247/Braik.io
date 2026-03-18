import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

const TEAM_WIDE_EVENT_VISIBILITY = ["TEAM", "PARENTS_AND_TEAM", "CUSTOM"]

type TeamUpdateItem = {
  id: string
  kind: "announcement" | "schedule" | "document" | "playbook"
  title: string
  subtitle: string
  href: string
  at: string
}

/**
 * GET /api/teams/[teamId]/team-updates
 * Announcements + team-wide shared content (schedule events, documents, playbooks)
 * visible to all roles on the team. Refreshed by dashboard polling (~10s).
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

    await requireTeamAccess(teamId)
    const supabase = getSupabaseServer()
    const items: TeamUpdateItem[] = []
    const now = Date.now()
    const soon = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString()
    const recentPast = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()

    const { data: teamRow } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!teamRow) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Platform / org announcements scoped to this team (admin → head coaches often; shown to all members here)
    const { data: annRows, error: annErr } = await supabase
      .from("announcements")
      .select("id, content, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(10)

    if (!annErr && annRows?.length) {
      for (const a of annRows) {
        const content = (a as { content?: string }).content?.trim() || ""
        const line = content.split("\n")[0]?.slice(0, 100) || "Announcement"
        items.push({
          id: `ann-${(a as { id: string }).id}`,
          kind: "announcement",
          title: line.length < content.length ? `${line}…` : line,
          subtitle: "Team announcement",
          href: `/dashboard/announcements?teamId=${encodeURIComponent(teamId)}`,
          at: (a as { created_at: string }).created_at,
        })
      }
    }

    // Calendar items visible to players/parents (not coaches-only)
    const { data: evRows, error: evErr } = await supabase
      .from("events")
      .select("id, title, event_type, start, location, created_at")
      .eq("team_id", teamId)
      .in("visibility", TEAM_WIDE_EVENT_VISIBILITY)
      .gte("start", recentPast)
      .lte("start", soon)
      .order("start", { ascending: true })
      .limit(15)

    if (!evErr && evRows?.length) {
      for (const e of evRows) {
        const row = e as {
          id: string
          title: string
          event_type: string
          start: string
          location: string | null
          created_at: string
        }
        const when = new Date(row.start)
        const typeLabel = (row.event_type || "Event").replace(/_/g, " ")
        items.push({
          id: `ev-${row.id}`,
          kind: "schedule",
          title: row.title,
          subtitle: `${typeLabel} · ${when.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${row.location ? ` · ${row.location}` : ""}`,
          href: `/dashboard/schedule?teamId=${encodeURIComponent(teamId)}&eventId=${encodeURIComponent(row.id)}`,
          at: row.created_at,
        })
      }
    }

    // Team documents marked visible to everyone on the team
    const { data: docRows, error: docErr } = await supabase
      .from("documents")
      .select("id, title, created_at")
      .eq("team_id", teamId)
      .eq("visibility", "all")
      .order("created_at", { ascending: false })
      .limit(8)

    if (!docErr && docRows?.length) {
      for (const d of docRows) {
        const row = d as { id: string; title: string; created_at: string }
        items.push({
          id: `doc-${row.id}`,
          kind: "document",
          title: row.title,
          subtitle: "Team document",
          href: `/dashboard/documents?teamId=${encodeURIComponent(teamId)}&documentId=${encodeURIComponent(row.id)}`,
          at: row.created_at,
        })
      }
    }

    // Playbooks shared with full team
    const { data: pbRows, error: pbErr } = await supabase
      .from("playbooks")
      .select("id, name, updated_at")
      .eq("team_id", teamId)
      .eq("visibility", "team")
      .order("updated_at", { ascending: false })
      .limit(8)

    if (!pbErr && pbRows?.length) {
      for (const p of pbRows) {
        const row = p as { id: string; name: string; updated_at: string }
        items.push({
          id: `pb-${row.id}`,
          kind: "playbook",
          title: row.name,
          subtitle: "Team playbook",
          href: `/dashboard/playbooks/${row.id}?teamId=${encodeURIComponent(teamId)}`,
          at: row.updated_at,
        })
      }
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    const updates = items.slice(0, 18)

    return NextResponse.json({ updates, fetchedAt: new Date().toISOString() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[GET team-updates]", err)
    return NextResponse.json({ error: "Failed to load team updates" }, { status: 500 })
  }
}
