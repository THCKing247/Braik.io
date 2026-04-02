/**
 * Resolve display organization name from Supabase nested `teams.programs.organizations`
 * (teams.program_id → programs.organization_id → organizations.name).
 * `teams.org` is not used — that column is not present in all deployments.
 */
export function organizationNameFromProgramsEmbed(programs: unknown): string | null {
  if (programs == null) return null
  const row = Array.isArray(programs) ? programs[0] : programs
  if (!row || typeof row !== "object") return null
  const org = (row as { organizations?: unknown }).organizations
  if (org == null) return null
  const o = Array.isArray(org) ? org[0] : org
  if (!o || typeof o !== "object") return null
  const name = (o as { name?: string | null }).name
  return typeof name === "string" && name.trim() ? name.trim() : null
}

/** Prefer linked organization name; fall back to team name for display. */
export function displayOrganizationName(team: {
  name?: string | null
  programs?: unknown
}): string {
  const fromProgram = organizationNameFromProgramsEmbed(team.programs)
  if (fromProgram) return fromProgram
  return (team.name ?? "").trim() || ""
}
