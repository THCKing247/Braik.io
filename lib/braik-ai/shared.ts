/**
 * Shared helpers and constants used across context modules.
 */

export type InjuryRowRelation = {
  player_id: string
  injury_reason: string
  expected_return_date: string | null
  status?: string
  notes?: string | null
  players?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
}

/** Parse player name from Supabase injury relation (single object or array). */
export function parseInjuryPlayerName(row: InjuryRowRelation): string {
  const p = row.players
  if (!p) return row.player_id
  if (Array.isArray(p)) return p[0] ? `${p[0].first_name} ${p[0].last_name}` : row.player_id
  return `${p.first_name} ${p.last_name}`
}

export const EMPTY_ENTITIES = {
  namedPlayers: [] as string[],
  positions: [] as string[],
  formationNames: [] as string[],
  playNames: [] as string[],
  concepts: [] as string[],
  dateTimeRefs: [] as string[],
  opponents: [] as string[],
} as const
