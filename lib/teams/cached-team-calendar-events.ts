import { startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  lightweightCached,
  LW_TTL_TEAM_CALENDAR,
  tagTeamCalendar,
} from "@/lib/cache/lightweight-get-cache"

/** Lean row select — no `*`. `description` maps to UI notes; `visibility` → audience; `created_by` for creator batch. */
const EVENT_SELECT_CALENDAR =
  "id, event_type, title, description, start, end, location, visibility, created_by"

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

function mapRowsToApi(
  rows: Record<string, unknown>[],
  creatorMap: Map<string, { name: string | null; email: string }>
): TeamCalendarEventApiRow[] {
  const visibilityToAudience: Record<string, string> = {
    TEAM: "players",
    PARENTS_AND_TEAM: "all",
    COACHES_ONLY: "staff",
    CUSTOM: "all",
  }
  return rows.map((e) => {
    const createdBy = e.created_by as string
    const creator = creatorMap.get(createdBy)
    return {
      id: e.id as string,
      type: (e.event_type as string) ?? "CUSTOM",
      title: (e.title as string) ?? "",
      start: e.start as string,
      end: e.end as string,
      location: (e.location as string | null) ?? null,
      notes: (e.description as string | null) ?? null,
      audience: visibilityToAudience[(e.visibility as string) ?? "TEAM"] ?? "players",
      creator: creator ? { name: creator.name, email: creator.email } : { name: null, email: "" },
      rsvps: [],
      linkedDocuments: [],
    }
  })
}

async function batchCreators(
  supabase: ReturnType<typeof getSupabaseServer>,
  rows: Record<string, unknown>[]
): Promise<Map<string, { name: string | null; email: string }>> {
  const creatorIds = [...new Set(rows.map((r) => r.created_by as string).filter(Boolean))]
  if (creatorIds.length === 0) return new Map()
  const { data: users } = await supabase.from("users").select("id, name, email").in("id", creatorIds)
  return new Map((users ?? []).map((u) => [u.id, { name: u.name ?? null, email: u.email ?? "" }]))
}

/**
 * Events overlapping [rangeStartIso, rangeEndIso] (inclusive window, overlap semantics:
 * start <= rangeEnd AND end >= rangeStart).
 */
export async function loadTeamCalendarEventsInRange(
  teamId: string,
  rangeStartIso: string,
  rangeEndIso: string
): Promise<TeamCalendarEventApiRow[]> {
  const supabase = getSupabaseServer()
  const { data: rows, error } = await supabase
    .from("events")
    .select(EVENT_SELECT_CALENDAR)
    .eq("team_id", teamId)
    .lte("start", rangeEndIso)
    .gte("end", rangeStartIso)
    .order("start", { ascending: true })

  if (error) {
    throw new Error(error.message || "events query failed")
  }

  const list = (rows ?? []) as Record<string, unknown>[]
  const creatorMap = await batchCreators(supabase, list)
  return mapRowsToApi(list, creatorMap)
}

/** Wider window for legacy clients that omit `from`/`to` (≈6 months back → 24 months forward, month-aligned). */
export function defaultCalendarEventsRangeIso(): { from: string; to: string } {
  const d = new Date()
  const from = startOfMonth(subMonths(d, 6))
  const to = endOfMonth(addMonths(d, 24))
  return { from: from.toISOString(), to: to.toISOString() }
}

export function getCachedTeamCalendarEventsInRange(
  teamId: string,
  fromIso: string,
  toIso: string
): Promise<TeamCalendarEventApiRow[]> {
  return lightweightCached(
    ["team-calendar-events-range-v1", teamId, fromIso, toIso],
    {
      revalidate: LW_TTL_TEAM_CALENDAR,
      tags: [tagTeamCalendar(teamId)],
    },
    () => loadTeamCalendarEventsInRange(teamId, fromIso, toIso)
  )
}

export function getCachedTeamCalendarEventsDefaultWindow(teamId: string): Promise<TeamCalendarEventApiRow[]> {
  const { from, to } = defaultCalendarEventsRangeIso()
  return getCachedTeamCalendarEventsInRange(teamId, from, to)
}
