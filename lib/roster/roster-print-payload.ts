import type { SupabaseClient } from "@supabase/supabase-js"
import { formatPositionDisplay, formatSchoolDisplayName } from "@/lib/roster/roster-document-format"

export const DEFAULT_ROSTER_TEMPLATE = {
  header: {
    showYear: true,
    showSchoolName: true,
    showTeamName: true,
    yearLabel: "Year",
    schoolNameLabel: "School",
    teamNameLabel: "Team",
  },
  body: {
    showJerseyNumber: true,
    showPlayerName: true,
    showGrade: true,
    showPosition: true,
    showWeight: true,
    showHeight: true,
    jerseyNumberLabel: "Number",
    playerNameLabel: "Name",
    gradeLabel: "Grade",
    positionLabel: "Position",
    weightLabel: "Weight",
    heightLabel: "Height",
    sortBy: "jerseyNumber" as const,
  },
  footer: {
    showGeneratedDate: true,
    customText: "",
  },
}

export type RosterPrintPayload = {
  success: true
  teamId: string
  team: {
    id: string
    name: string
    schoolName: string | null
    seasonName: string | null
    year: number
  }
  template: typeof DEFAULT_ROSTER_TEMPLATE
  players: Array<{
    id: string
    jerseyNumber: number | null
    name: string
    grade: number | null
    gradeLabel: string | null
    position: string | null
    weight: number | null
    height: string | null
    /** Roster membership: e.g. active | inactive */
    rosterStatus?: string
    /** health_status: active | injured | unavailable */
    healthStatus?: string | null
  }>
  generatedAt: string
}

/**
 * Build roster print/email payload. Caller must enforce auth.
 */
export async function buildRosterPrintPayload(
  supabase: SupabaseClient,
  teamId: string,
  options?: { playerIds?: string[] | null; fullRoster?: boolean }
): Promise<RosterPrintPayload | { error: string; stage: string }> {
  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select("id")
    .eq("id", teamId)
    .maybeSingle()

  if (teamError) {
    return { error: "Failed to load team", stage: "team_base" }
  }
  if (!teamRow) {
    return { error: "Team not found", stage: "team" }
  }

  let teamName = "Team"
  let teamOrg: string | null = null
  try {
    const { data: display } = await supabase.from("teams").select("name, org").eq("id", teamId).maybeSingle()
    if (display) {
      const d = display as { name?: string | null; org?: string | null }
      if (d.name != null && d.name !== "") teamName = d.name
      if (d.org != null && d.org !== "") teamOrg = d.org
    }
  } catch {
    /* ignore */
  }

  let playersQuery = supabase
    .from("players")
    .select("id, first_name, last_name, grade, jersey_number, position_group, weight, height, status, health_status")
    .eq("team_id", teamId)
  if (!options?.fullRoster) {
    playersQuery = playersQuery.eq("status", "active")
  }
  const { data: players, error: playersError } = await playersQuery
    .order("jersey_number", { ascending: true, nullsFirst: false })
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })

  if (playersError) {
    return { error: "Failed to load roster", stage: "players" }
  }

  let playerRows = players || []
  const filter = options?.playerIds?.filter(Boolean)
  if (filter && filter.length > 0) {
    const set = new Set(filter)
    playerRows = playerRows.filter((p) => set.has((p as { id: string }).id))
  }

  let seasonName: string | null = null
  let rosterTemplate: typeof DEFAULT_ROSTER_TEMPLATE | null = null
  try {
    const { data: meta } = await supabase.from("teams").select("season_name, roster_template").eq("id", teamId).maybeSingle()
    if (meta) {
      seasonName = (meta as { season_name?: string | null }).season_name ?? null
      const raw = (meta as { roster_template?: unknown }).roster_template
      if (raw && typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
        rosterTemplate = raw as typeof DEFAULT_ROSTER_TEMPLATE
      }
    }
  } catch {
    /* ignore */
  }

  let schoolName: string | null = null
  try {
    const { data: teamWithSchool } = await supabase.from("teams").select("school_id").eq("id", teamId).maybeSingle()
    if (teamWithSchool && (teamWithSchool as { school_id?: string | null }).school_id) {
      const schoolId = (teamWithSchool as { school_id: string }).school_id
      const { data: school } = await supabase.from("schools").select("name").eq("id", schoolId).maybeSingle()
      if (school && (school as { name?: string }).name) {
        schoolName = (school as { name: string }).name
      }
    }
  } catch {
    /* ignore */
  }
  if (!schoolName && teamOrg) schoolName = teamOrg

  const currentYear = new Date().getFullYear()
  const template = {
    ...DEFAULT_ROSTER_TEMPLATE,
    ...rosterTemplate,
    header: { ...DEFAULT_ROSTER_TEMPLATE.header, ...(rosterTemplate?.header ?? {}) },
    body: { ...DEFAULT_ROSTER_TEMPLATE.body, ...(rosterTemplate?.body ?? {}) },
    footer: { ...DEFAULT_ROSTER_TEMPLATE.footer, ...(rosterTemplate?.footer ?? {}) },
  }

  const formattedPlayers = playerRows.map((p) => {
    const row = p as {
      id: string
      first_name: string
      last_name: string
      grade: number | null
      jersey_number: number | null
      position_group?: string | null
      weight?: number | null
      height?: string | null
      status?: string | null
      health_status?: string | null
    }
    return {
      id: row.id,
      jerseyNumber: row.jersey_number,
      name: `${row.first_name} ${row.last_name}`,
      grade: row.grade,
      gradeLabel: row.grade
        ? row.grade === 9
          ? "Freshman"
          : row.grade === 10
            ? "Sophomore"
            : row.grade === 11
              ? "Junior"
              : row.grade === 12
                ? "Senior"
                : `Grade ${row.grade}`
        : null,
      position:
        row.position_group != null && String(row.position_group).trim() !== ""
          ? formatPositionDisplay(row.position_group)
          : null,
      weight: row.weight != null ? row.weight : null,
      height: row.height ?? null,
      rosterStatus: row.status ?? undefined,
      healthStatus: row.health_status ?? null,
    }
  })

  if (template.body.sortBy === "jerseyNumber") {
    formattedPlayers.sort((a, b) => {
      if (a.jerseyNumber === null && b.jerseyNumber === null) return 0
      if (a.jerseyNumber === null) return 1
      if (b.jerseyNumber === null) return -1
      return a.jerseyNumber - b.jerseyNumber
    })
  }

  const schoolDisplay = schoolName ? formatSchoolDisplayName(schoolName) : null

  return {
    success: true,
    teamId: teamRow.id,
    team: {
      id: teamRow.id,
      name: teamName,
      schoolName: schoolDisplay,
      seasonName,
      year: currentYear,
    },
    template,
    players: formattedPlayers,
    generatedAt: new Date().toISOString(),
  }
}

/** Shape used by roster print modal after validating API JSON (prevents render crashes). */
export type RosterPrintClientData = {
  team: RosterPrintPayload["team"]
  template: typeof DEFAULT_ROSTER_TEMPLATE
  players: RosterPrintPayload["players"]
  generatedAt: string
}

/** CSS injected for browser print — avoids styled-jsx dependency issues in production. */
export const ROSTER_PRINT_PORTAL_CSS = `
@media print {
  @page { margin: 0 !important; size: auto; }
  body * { display: none !important; }
  body > .roster-print-portal {
    display: block !important;
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    height: auto !important;
    overflow: visible !important;
    pointer-events: auto !important;
  }
  body > .roster-print-portal * {
    display: revert !important;
    visibility: visible !important;
    color: black !important;
  }
  body > .roster-print-portal .roster-print-root {
    display: block !important;
    position: static !important;
    margin: 0 auto !important;
    padding: 0.5in !important;
    color: black !important;
  }
}
`

/**
 * Parse GET /api/roster/print JSON safely: merge template with defaults, coerce players.
 * Returns null if the payload is not a successful roster print response.
 */
export function parseRosterPrintClientData(raw: unknown): RosterPrintClientData | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (o.success !== true) return null

  const teamRaw = o.team
  if (!teamRaw || typeof teamRaw !== "object") return null
  const tr = teamRaw as Record<string, unknown>
  const teamId = typeof tr.id === "string" ? tr.id : ""
  const rawName = typeof tr.name === "string" ? tr.name : ""
  const teamName = rawName.trim() || "Team"
  if (!teamId) return null

  const team: RosterPrintPayload["team"] = {
    id: teamId,
    name: teamName,
    schoolName: typeof tr.schoolName === "string" || tr.schoolName === null ? (tr.schoolName as string | null) : null,
    seasonName: typeof tr.seasonName === "string" || tr.seasonName === null ? (tr.seasonName as string | null) : null,
    year: typeof tr.year === "number" && Number.isFinite(tr.year) ? tr.year : new Date().getFullYear(),
  }

  const tpl = o.template
  const rawTemplate =
    tpl && typeof tpl === "object" && tpl !== null && !Array.isArray(tpl)
      ? (tpl as Partial<typeof DEFAULT_ROSTER_TEMPLATE>)
      : null
  const template = {
    ...DEFAULT_ROSTER_TEMPLATE,
    ...(rawTemplate ?? {}),
    header: { ...DEFAULT_ROSTER_TEMPLATE.header, ...(rawTemplate?.header ?? {}) },
    body: { ...DEFAULT_ROSTER_TEMPLATE.body, ...(rawTemplate?.body ?? {}) },
    footer: { ...DEFAULT_ROSTER_TEMPLATE.footer, ...(rawTemplate?.footer ?? {}) },
  }

  const players: RosterPrintPayload["players"] = Array.isArray(o.players)
    ? (o.players as unknown[]).map((p, idx) => {
        const row = p && typeof p === "object" ? (p as Record<string, unknown>) : {}
        return {
          id: typeof row.id === "string" ? row.id : `row-${idx}`,
          jerseyNumber: typeof row.jerseyNumber === "number" ? row.jerseyNumber : null,
          name: typeof row.name === "string" ? row.name : "",
          grade: typeof row.grade === "number" ? row.grade : null,
          gradeLabel:
            typeof row.gradeLabel === "string" || row.gradeLabel === null ? (row.gradeLabel as string | null) : null,
          position: typeof row.position === "string" || row.position === null ? (row.position as string | null) : null,
          weight: typeof row.weight === "number" ? row.weight : null,
          height: typeof row.height === "string" || row.height === null ? (row.height as string | null) : null,
          rosterStatus: typeof row.rosterStatus === "string" ? row.rosterStatus : undefined,
          healthStatus:
            typeof row.healthStatus === "string" || row.healthStatus === null
              ? (row.healthStatus as string | null)
              : null,
        }
      })
    : []

  const generatedAt = typeof o.generatedAt === "string" ? o.generatedAt : new Date().toISOString()

  return { team, template, players, generatedAt }
}
