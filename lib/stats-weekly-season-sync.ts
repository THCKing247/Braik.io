/**
 * Recompute players.season_stats aggregate keys from all non-deleted weekly rows per player.
 * Sums only SEASON_STAT_KEYS; other keys on season_stats are preserved.
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { SEASON_STAT_KEYS } from "@/lib/stats-helpers"

function statContribution(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return 0
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  return Math.trunc(n)
}

export async function recalculateSeasonStatsFromWeeklyForPlayers(
  supabase: SupabaseClient,
  teamId: string,
  playerIds: string[]
): Promise<void> {
  const unique = [...new Set(playerIds.filter(Boolean))]
  if (unique.length === 0) return

  const { data: entries, error: fetchErr } = await supabase
    .from("player_weekly_stat_entries")
    .select("player_id, stats")
    .eq("team_id", teamId)
    .in("player_id", unique)
    .is("deleted_at", null)

  if (fetchErr) {
    console.error("[recalculateSeasonStatsFromWeeklyForPlayers] fetch entries", fetchErr)
    throw new Error("Failed to load weekly entries for season sync")
  }

  const sums = new Map<string, Record<string, number>>()
  for (const pid of unique) {
    sums.set(
      pid,
      Object.fromEntries(SEASON_STAT_KEYS.map((k) => [k, 0])) as Record<string, number>
    )
  }

  for (const row of entries ?? []) {
    const pid = row.player_id as string
    const acc = sums.get(pid)
    if (!acc) continue
    const st = row.stats
    if (st == null || typeof st !== "object" || Array.isArray(st)) continue
    const o = st as Record<string, unknown>
    for (const k of SEASON_STAT_KEYS) {
      acc[k] += statContribution(o[k])
    }
  }

  const now = new Date().toISOString()

  for (const pid of unique) {
    const { data: player, error: pErr } = await supabase
      .from("players")
      .select("season_stats")
      .eq("id", pid)
      .eq("team_id", teamId)
      .maybeSingle()

    if (pErr || !player) {
      if (pErr) console.error("[recalculateSeasonStatsFromWeeklyForPlayers] player fetch", pErr)
      continue
    }

    const existing = player.season_stats
    const next: Record<string, unknown> =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {}

    const acc = sums.get(pid)!
    for (const k of SEASON_STAT_KEYS) {
      next[k] = acc[k]
    }

    const { error: upErr } = await supabase
      .from("players")
      .update({ season_stats: next, updated_at: now })
      .eq("id", pid)
      .eq("team_id", teamId)

    if (upErr) {
      console.error("[recalculateSeasonStatsFromWeeklyForPlayers] player update", upErr)
    }
  }
}
