import type { SupabaseClient } from "@supabase/supabase-js"

export type RosterLimitScope = "none" | "team" | "program"

export interface RosterEntitlement {
  scope: RosterLimitScope
  /** null = unlimited */
  limit: number | null
  programId: string | null
  /** DB read failed or team missing — callers must fail closed when enforcing caps */
  lookupFailed?: boolean
}

export async function getRosterEntitlement(
  supabase: SupabaseClient,
  teamId: string
): Promise<RosterEntitlement> {
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, program_id, roster_slot_limit")
    .eq("id", teamId)
    .maybeSingle()

  if (error) {
    console.error("[roster-entitlement] team row lookup failed", error)
    return { scope: "none", limit: null, programId: null, lookupFailed: true }
  }
  if (!team) {
    return { scope: "none", limit: null, programId: null, lookupFailed: true }
  }

  const programId = (team as { program_id?: string | null }).program_id ?? null
  if (programId) {
    const { data: prog } = await supabase
      .from("programs")
      .select("roster_slot_limit")
      .eq("id", programId)
      .maybeSingle()
    const progLimit = (prog as { roster_slot_limit?: number | null } | null)?.roster_slot_limit
    if (progLimit != null && progLimit > 0) {
      return { scope: "program", limit: progLimit, programId }
    }
  }

  const teamLimit = (team as { roster_slot_limit?: number | null }).roster_slot_limit
  if (teamLimit != null && teamLimit > 0) {
    return { scope: "team", limit: teamLimit, programId }
  }

  return { scope: "none", limit: null, programId }
}

/** Active roster rows count toward purchased slots; inactive frees a slot. */
export async function countActivePlayersForEntitlement(
  supabase: SupabaseClient,
  teamId: string,
  entitlement: RosterEntitlement
): Promise<number | null> {
  if (entitlement.scope === "program" && entitlement.programId) {
    const { data: teamIds, error: teamsErr } = await supabase
      .from("teams")
      .select("id")
      .eq("program_id", entitlement.programId)
    if (teamsErr) {
      console.error("[roster-entitlement] program team list failed", teamsErr)
      return null
    }
    const ids = (teamIds ?? []).map((t: { id: string }) => t.id)
    if (ids.length === 0) return 0
    const { count, error } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .in("team_id", ids)
      .eq("status", "active")
    if (error) {
      console.error("[roster-entitlement] program count failed", error)
      return null
    }
    return count ?? 0
  }

  const { count, error } = await supabase
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("status", "active")

  if (error) {
    console.error("[roster-entitlement] team count failed", error)
    return null
  }
  return count ?? 0
}

export type RosterCapacityResult =
  | { ok: true }
  | { ok: false; message: string; limit: number; current: number }

export async function assertCanAddActivePlayers(
  supabase: SupabaseClient,
  teamId: string,
  additionalActive: number
): Promise<RosterCapacityResult> {
  if (additionalActive <= 0) return { ok: true }

  const ent = await getRosterEntitlement(supabase, teamId)
  if (ent.lookupFailed) {
    return {
      ok: false,
      limit: 0,
      current: 0,
      message:
        "Could not verify roster capacity (temporary server issue). Try again in a moment. If this continues, contact support.",
    }
  }
  if (ent.limit == null) return { ok: true }

  const current = await countActivePlayersForEntitlement(supabase, teamId, ent)
  if (current === null) {
    return {
      ok: false,
      limit: ent.limit,
      current: 0,
      message:
        "Could not verify roster capacity (temporary server issue). Try again in a moment. If this continues, contact support.",
    }
  }
  if (current + additionalActive <= ent.limit) return { ok: true }

  return {
    ok: false,
    limit: ent.limit,
    current,
    message:
      ent.scope === "program"
        ? `Program roster limit reached (${ent.limit} active players across all teams in this program). Deactivate a player or purchase more slots.`
        : `Team roster limit reached (${ent.limit} active players). Deactivate a player or purchase more slots.`,
  }
}
