import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeIncomingShortIdSegment } from "@/lib/navigation/canonical-short-id-paths"
import { resolvePlayerUuidForTeamRosterSegment } from "@/lib/roster/resolve-roster-player-segment"

type TeamIdentityRow = {
  id: string
  created_at?: string | null
  athletic_department_id?: string | null
  program_id?: string | null
}

/** Resolved route parts for URL builders. `organizationPortalUuid` is for internal/JSON only — never put it in browser paths. */
export type CanonicalTeamRoute = {
  shortOrgId: string
  shortTeamId: string
  organizationPortalUuid?: string
}

/** Inputs allowed for visible dashboard team URLs (path segments must be short IDs). */
export type DashboardTeamPathParams = {
  shortOrgId: string
  shortTeamId: string
}

/** Matches browser-visible canonical team dashboard URLs (`/dashboard/org/:shortOrgId/team/:shortTeamId`). */
export const CANONICAL_DASHBOARD_TEAM_PATH_RE = /^\/dashboard\/org\/[^/]+\/team\/[^/]+/

function toCanonicalPathSuffix(pathSuffix?: string): string {
  if (!pathSuffix || pathSuffix === "/") return ""
  return pathSuffix.startsWith("/") ? pathSuffix : `/${pathSuffix}`
}

export function buildOrganizationPortalPath(shortOrgId: string, pagePath?: string): string {
  const suffix = toCanonicalPathSuffix(pagePath)
  return `/org/${encodeURIComponent(shortOrgId)}${suffix}`
}

export function buildDashboardTeamPath(input: DashboardTeamPathParams, nestedPath?: string): string {
  const suffix = toCanonicalPathSuffix(nestedPath)
  return `/dashboard/org/${encodeURIComponent(input.shortOrgId)}/team/${encodeURIComponent(input.shortTeamId)}${suffix}`
}

export function buildDashboardTeamBasePath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts)
}

/** Parse `/dashboard/org/:shortOrgId/team/:shortTeamId` from a pathname (query string ignored). */
export function parseCanonicalDashboardTeamPath(pathname: string): DashboardTeamPathParams | null {
  const bare = pathname.split("?")[0] ?? pathname
  const m = bare.match(/^\/dashboard\/org\/([^/]+)\/team\/([^/]+)(?:\/|$)/)
  if (!m) return null
  return {
    shortOrgId: decodeURIComponent(m[1]),
    shortTeamId: decodeURIComponent(m[2]),
  }
}

export function buildDashboardTeamRosterPath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts, "/roster")
}

export function buildDashboardTeamCalendarPath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts, "/calendar")
}

export function buildDashboardTeamSchedulePath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts, "/schedule")
}

export function buildDashboardTeamMessagesPath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts, "/messages")
}

/** Active thread/conversation segment (thread UUID) under team messages. */
export function buildDashboardTeamMessagePath(parts: DashboardTeamPathParams, threadOrMessageId: string): string {
  const id = encodeURIComponent(threadOrMessageId)
  return buildDashboardTeamPath(parts, `/messages/${id}`)
}

/** Parse `/dashboard/org/.../team/.../messages` and optional `/messages/:threadId`. */
export function parseCanonicalTeamMessagesPath(pathname: string): {
  parts: DashboardTeamPathParams
  threadId?: string
} | null {
  const bare = pathname.split("?")[0] ?? pathname
  const m = bare.match(/^\/dashboard\/org\/([^/]+)\/team\/([^/]+)\/messages(?:\/([^/]+))?$/)
  if (!m) return null
  const parts: DashboardTeamPathParams = {
    shortOrgId: decodeURIComponent(m[1]),
    shortTeamId: decodeURIComponent(m[2]),
  }
  const seg = m[3]
  if (!seg) return { parts }
  return { parts, threadId: decodeURIComponent(seg) }
}

export function buildDashboardTeamStatsPath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts, "/stats")
}

export function buildDashboardTeamSettingsPath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts, "/settings")
}

export function buildDashboardTeamDocumentsPath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts, "/documents")
}

export function buildDashboardTeamFilmPath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts, "/game-video")
}

export function buildDashboardTeamPlaybooksPath(parts: DashboardTeamPathParams): string {
  return buildDashboardTeamPath(parts, "/playbooks")
}

async function fetchAllOrganizationPortals(
  supabase: SupabaseClient
): Promise<Array<{ id: string; created_at?: string | null }>> {
  const { data } = await supabase.from("athletic_departments").select("id, created_at")
  return (data ?? []) as Array<{ id: string; created_at?: string | null }>
}

function sortByCreationThenId<T extends { id: string; created_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aTs = a.created_at ? Date.parse(a.created_at) : 0
    const bTs = b.created_at ? Date.parse(b.created_at) : 0
    if (aTs !== bTs) return aTs - bTs
    return a.id.localeCompare(b.id)
  })
}

export async function resolveShortOrgIdForOrganizationPortalUuid(
  supabase: SupabaseClient,
  organizationPortalUuid: string
): Promise<string | null> {
  const rows = sortByCreationThenId(await fetchAllOrganizationPortals(supabase))
  const index = rows.findIndex((r) => r.id === organizationPortalUuid)
  if (index < 0) return null
  return String(index + 1)
}

export async function resolveOrganizationPortalUuidFromShortOrgId(
  supabase: SupabaseClient,
  shortOrgId: string
): Promise<string | null> {
  const key = normalizeIncomingShortIdSegment(shortOrgId)
  if (!/^\d+$/.test(key)) return null
  const ordinal = Number.parseInt(key, 10)
  if (!Number.isFinite(ordinal) || ordinal <= 0) return null
  const rows = sortByCreationThenId(await fetchAllOrganizationPortals(supabase))
  return rows[ordinal - 1]?.id ?? null
}

async function resolveOrganizationPortalUuidFromProgram(
  supabase: SupabaseClient,
  programId: string | null | undefined
): Promise<string | null> {
  if (!programId) return null
  const { data: program } = await supabase
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .maybeSingle()
  const organizationId = (program as { organization_id?: string | null } | null)?.organization_id ?? null
  if (!organizationId) return null
  const { data: organization } = await supabase
    .from("organizations")
    .select("athletic_department_id")
    .eq("id", organizationId)
    .maybeSingle()
  return (organization as { athletic_department_id?: string | null } | null)?.athletic_department_id ?? null
}

async function fetchOrganizationTeams(
  supabase: SupabaseClient,
  organizationPortalUuid: string
): Promise<TeamIdentityRow[]> {
  const [directTeamsRes, orgRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, created_at, athletic_department_id, program_id")
      .eq("athletic_department_id", organizationPortalUuid),
    supabase
      .from("organizations")
      .select("id")
      .eq("athletic_department_id", organizationPortalUuid),
  ])

  const directTeams = (directTeamsRes.data ?? []) as TeamIdentityRow[]
  const organizationIds = (orgRes.data ?? []).map((r) => r.id).filter(Boolean)

  if (organizationIds.length === 0) {
    return directTeams
  }

  const { data: programs } = await supabase
    .from("programs")
    .select("id")
    .in("organization_id", organizationIds)

  const programIds = (programs ?? []).map((r) => r.id).filter(Boolean)
  if (programIds.length === 0) {
    return directTeams
  }

  const { data: programTeams } = await supabase
    .from("teams")
    .select("id, created_at, athletic_department_id, program_id")
    .in("program_id", programIds)

  const all = [...directTeams, ...((programTeams ?? []) as TeamIdentityRow[])]
  const byId = new Map<string, TeamIdentityRow>()
  for (const row of all) {
    if (!row?.id) continue
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  return [...byId.values()]
}

function sortTeamsForShortId(rows: TeamIdentityRow[]): TeamIdentityRow[] {
  return [...rows].sort((a, b) => {
    const aTs = a.created_at ? Date.parse(a.created_at) : 0
    const bTs = b.created_at ? Date.parse(b.created_at) : 0
    if (aTs !== bTs) return aTs - bTs
    return a.id.localeCompare(b.id)
  })
}

export async function resolveOrganizationPortalUuidForTeam(
  supabase: SupabaseClient,
  teamId: string
): Promise<string | null> {
  const { data: team } = await supabase
    .from("teams")
    .select("id, athletic_department_id, program_id")
    .eq("id", teamId)
    .maybeSingle()
  if (!team?.id) return null
  const direct = (team as { athletic_department_id?: string | null }).athletic_department_id ?? null
  if (direct) return direct
  return resolveOrganizationPortalUuidFromProgram(
    supabase,
    (team as { program_id?: string | null }).program_id ?? null
  )
}

export async function resolveCanonicalTeamRouteByTeamId(
  supabase: SupabaseClient,
  teamId: string
): Promise<CanonicalTeamRoute | null> {
  const organizationPortalUuid = await resolveOrganizationPortalUuidForTeam(supabase, teamId)
  if (!organizationPortalUuid) return null
  const shortOrgId = await resolveShortOrgIdForOrganizationPortalUuid(supabase, organizationPortalUuid)
  if (!shortOrgId) return null
  const allTeams = sortTeamsForShortId(await fetchOrganizationTeams(supabase, organizationPortalUuid))
  const index = allTeams.findIndex((t) => t.id === teamId)
  if (index < 0) return null
  return {
    shortOrgId,
    organizationPortalUuid,
    shortTeamId: String(index + 1),
  }
}

export async function resolveTeamIdFromShortOrgTeamIds(
  supabase: SupabaseClient,
  shortOrgId: string,
  shortTeamId: string
): Promise<string | null> {
  const organizationPortalUuid = await resolveOrganizationPortalUuidFromShortOrgId(supabase, shortOrgId)
  if (!organizationPortalUuid) return null
  const key = normalizeIncomingShortIdSegment(shortTeamId)
  if (!/^\d+$/.test(key)) return null
  const ordinal = Number.parseInt(key, 10)
  if (!Number.isFinite(ordinal) || ordinal <= 0) return null
  const allTeams = sortTeamsForShortId(await fetchOrganizationTeams(supabase, organizationPortalUuid))
  return allTeams[ordinal - 1]?.id ?? null
}

export async function resolveDefaultOrganizationPortalUuidForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: dept } = await supabase
    .from("athletic_departments")
    .select("id")
    .eq("athletic_director_user_id", userId)
    .maybeSingle()
  if (dept?.id) return dept.id

  const { data: profile } = await supabase
    .from("profiles")
    .select("team_id")
    .eq("id", userId)
    .maybeSingle()
  const profileTeamId = (profile as { team_id?: string | null } | null)?.team_id ?? null
  if (profileTeamId) {
    const viaProfile = await resolveOrganizationPortalUuidForTeam(supabase, profileTeamId)
    if (viaProfile) return viaProfile
  }

  const { data: memberRow } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle()
  const memberTeamId = (memberRow as { team_id?: string | null } | null)?.team_id ?? null
  if (!memberTeamId) return null
  return resolveOrganizationPortalUuidForTeam(supabase, memberTeamId)
}

export async function resolveDefaultShortOrgIdForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const organizationPortalUuid = await resolveDefaultOrganizationPortalUuidForUser(supabase, userId)
  if (!organizationPortalUuid) return null
  return resolveShortOrgIdForOrganizationPortalUuid(supabase, organizationPortalUuid)
}

/** Canonical player profile URL params (browser-visible short IDs only). */
export type DashboardTeamPlayerPathParams = DashboardTeamPathParams & {
  playerAccountId: string
}

export function buildDashboardTeamPlayerPath(parts: DashboardTeamPlayerPathParams): string {
  const id = encodeURIComponent(parts.playerAccountId.trim())
  return buildDashboardTeamPath(parts, `/roster/${id}`)
}

/** Parse `/dashboard/org/.../team/.../roster/:playerAccountId` from pathname (nested segments ignored here). */
export function parseCanonicalDashboardTeamRosterPlayerPath(
  pathname: string
): DashboardTeamPlayerPathParams | null {
  const bare = pathname.split("?")[0] ?? pathname
  const m = bare.match(/^\/dashboard\/org\/([^/]+)\/team\/([^/]+)\/roster\/([^/]+)/)
  if (!m) return null
  return {
    shortOrgId: decodeURIComponent(m[1]),
    shortTeamId: decodeURIComponent(m[2]),
    playerAccountId: decodeURIComponent(m[3]),
  }
}

export type CanonicalPlayerRoute = CanonicalTeamRoute & {
  playerAccountId: string
}

/** Player UUID → short org/team segments + player_account_id for canonical URLs. */
export async function resolveCanonicalPlayerRouteByPlayerUuid(
  supabase: SupabaseClient,
  playerUuid: string
): Promise<CanonicalPlayerRoute | null> {
  const { data: player } = await supabase
    .from("players")
    .select("team_id, player_account_id")
    .eq("id", playerUuid)
    .maybeSingle()
  const row = player as { team_id?: string | null; player_account_id?: string | null } | null
  const teamId = row?.team_id ?? null
  const playerAccountId = row?.player_account_id ?? null
  if (!teamId || !playerAccountId) return null

  const teamCanon = await resolveCanonicalTeamRouteByTeamId(supabase, teamId)
  if (!teamCanon) return null
  return {
    ...teamCanon,
    playerAccountId,
  }
}

/**
 * Resolve dashboard `playerAccountId` path segment to internal `players.id` (UUID), scoped to the team
 * from `shortOrgId` + `shortTeamId` (legacy `playerRouteSegment` name kept for call sites).
 */
export async function resolvePlayerUuidFromDashboardShortRoute(
  supabase: SupabaseClient,
  shortOrgId: string,
  shortTeamId: string,
  playerRouteSegment: string
): Promise<string | null> {
  const teamId = await resolveTeamIdFromShortOrgTeamIds(supabase, shortOrgId, shortTeamId)
  if (!teamId) return null
  return resolvePlayerUuidForTeamRosterSegment(supabase, teamId, playerRouteSegment)
}
