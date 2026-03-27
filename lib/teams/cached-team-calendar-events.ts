import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  lightweightCached,
  LW_TTL_TEAM_CALENDAR,
  tagTeamCalendar,
} from "@/lib/cache/lightweight-get-cache"

export type TeamCalendarEventApiRow = {
  id: string
  type: string
  title: string
  start: string
  end: string
  location: string | null
  notes: string | null
  audience: string
  creator: { name: string | null; email: string }
  rsvps: Array<{ player: { firstName: string; lastName: string }; status: string }>
  linkedDocuments: Array<{
    document: { id: string; title: string; fileName: string; fileUrl: string; fileSize: number | null; mimeType: string | null }
  }>
}

/**
 * Full team calendar list for GET /api/teams/[teamId]/calendar/events.
 * Service-role client returns the same rows for all members; RBAC is enforced on the route before calling this.
 */
export async function loadTeamCalendarEventsForApi(teamId: string): Promise<TeamCalendarEventApiRow[]> {
  const supabase = getSupabaseServer()
  const { data: rows, error } = await supabase
    .from("events")
    .select("id, event_type, title, description, start, end, location, visibility, created_by, created_at")
    .eq("team_id", teamId)
    .order("start", { ascending: true })

  if (error) {
    throw new Error(error.message || "events query failed")
  }

  const creatorIds = [...new Set((rows ?? []).map((r) => r.created_by))]
  let creatorMap = new Map<string, { name: string | null; email: string }>()
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, name, email").in("id", creatorIds)
    creatorMap = new Map((users ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }]))
  }

  const visibilityToAudience: Record<string, string> = {
    TEAM: "players",
    PARENTS_AND_TEAM: "all",
    COACHES_ONLY: "staff",
    CUSTOM: "all",
  }

  return (rows ?? []).map((e) => {
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
      rsvps: [],
      linkedDocuments: [],
    }
  })
}

export function getCachedTeamCalendarEvents(teamId: string): Promise<TeamCalendarEventApiRow[]> {
  return lightweightCached(
    ["team-calendar-events-api-v1", teamId],
    {
      revalidate: LW_TTL_TEAM_CALENDAR,
      tags: [tagTeamCalendar(teamId)],
    },
    () => loadTeamCalendarEventsForApi(teamId)
  )
}
