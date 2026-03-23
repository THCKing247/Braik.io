import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeWeeklyStatsForStorage, sanitizeWeeklyStatsInput } from "@/lib/stats-weekly-api"
import {
  insertWeeklyStatEntryAudit,
  weeklyEntryRowToAuditSnapshot,
} from "@/lib/stats-weekly-audit"
import { recalculateSeasonStatsFromWeeklyForPlayers } from "@/lib/stats-weekly-season-sync"

type RowIn = { playerId: string; stats: Record<string, unknown> }

/**
 * Persist schedule “player stats” into `player_weekly_stat_entries` (canonical) and mirror `player_game_stats`.
 */
export async function syncSchedulePlayerStatsToWeeklyAndMirror(
  supabase: SupabaseClient,
  teamId: string,
  gameId: string,
  userId: string,
  rows: RowIn[]
): Promise<void> {
  const { data: gameFull, error: gErr } = await supabase
    .from("games")
    .select("opponent, game_date, season_id, seasons(year)")
    .eq("id", gameId)
    .eq("team_id", teamId)
    .maybeSingle()

  if (gErr || !gameFull) {
    throw new Error("Game not found")
  }

  const seasons = gameFull.seasons as { year?: number } | null | undefined
  const seasonYear = seasons?.year ?? null
  const opponent = (gameFull.opponent as string | null) ?? null
  const gameDate =
    gameFull.game_date != null ? String(gameFull.game_date).slice(0, 10) : null

  const playerIdsForSync = new Set<string>()
  const now = new Date().toISOString()

  for (const r of rows) {
    const statsNorm = normalizeWeeklyStatsForStorage(sanitizeWeeklyStatsInput(r.stats))
    playerIdsForSync.add(r.playerId)

    const { data: existingList, error: exErr } = await supabase
      .from("player_weekly_stat_entries")
      .select("*")
      .eq("team_id", teamId)
      .eq("player_id", r.playerId)
      .eq("game_id", gameId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)

    if (exErr) {
      throw new Error("Failed to load weekly entry")
    }

    const existing = existingList?.[0] as Record<string, unknown> | undefined

    if (Object.keys(statsNorm).length === 0) {
      if (!existing) continue
      const entryId = existing.id as string
      const beforeSnap = weeklyEntryRowToAuditSnapshot(existing)
      const { data: afterRow, error: softErr } = await supabase
        .from("player_weekly_stat_entries")
        .update({
          deleted_at: now,
          deleted_by: userId,
          updated_at: now,
          updated_by: userId,
        })
        .eq("id", entryId)
        .eq("team_id", teamId)
        .is("deleted_at", null)
        .select("*")
        .maybeSingle()

      if (softErr || !afterRow) {
        throw new Error("Failed to clear weekly stats")
      }
      await insertWeeklyStatEntryAudit(supabase, {
        entryId,
        teamId,
        action: "soft_delete",
        beforeData: beforeSnap,
        afterData: weeklyEntryRowToAuditSnapshot(afterRow as Record<string, unknown>),
        actedBy: userId,
      })
      continue
    }

    if (existing) {
      const entryId = existing.id as string
      const beforeSnap = weeklyEntryRowToAuditSnapshot(existing)
      const { data: updated, error: upErr } = await supabase
        .from("player_weekly_stat_entries")
        .update({
          stats: statsNorm,
          opponent: opponent ?? (existing.opponent as string | null),
          game_date: gameDate ?? (existing.game_date as string | null),
          season_year: seasonYear ?? (existing.season_year as number | null),
          updated_at: now,
          updated_by: userId,
        })
        .eq("id", entryId)
        .eq("team_id", teamId)
        .select("*")
        .maybeSingle()

      if (upErr || !updated) {
        throw new Error("Failed to update weekly stats")
      }
      await insertWeeklyStatEntryAudit(supabase, {
        entryId,
        teamId,
        action: "update",
        beforeData: beforeSnap,
        afterData: weeklyEntryRowToAuditSnapshot(updated as Record<string, unknown>),
        actedBy: userId,
      })
    } else {
      const insertRow = {
        team_id: teamId,
        player_id: r.playerId,
        season_year: seasonYear,
        week_number: null as number | null,
        game_id: gameId,
        opponent,
        game_date: gameDate,
        stats: statsNorm,
        created_by: userId,
        updated_by: userId,
      }
      const { data: inserted, error: insErr } = await supabase
        .from("player_weekly_stat_entries")
        .insert(insertRow)
        .select("*")
        .maybeSingle()

      if (insErr || !inserted) {
        throw new Error("Failed to create weekly stats")
      }
      await insertWeeklyStatEntryAudit(supabase, {
        entryId: inserted.id as string,
        teamId,
        action: "create",
        beforeData: null,
        afterData: weeklyEntryRowToAuditSnapshot(inserted as Record<string, unknown>),
        actedBy: userId,
      })
    }
  }

  await recalculateSeasonStatsFromWeeklyForPlayers(supabase, teamId, [...playerIdsForSync])

  const { error: delErr } = await supabase.from("player_game_stats").delete().eq("game_id", gameId).eq("team_id", teamId)
  if (delErr) {
    throw new Error("Failed to sync player_game_stats mirror")
  }

  const mirrorRows = rows
    .map((r) => {
      const statsNorm = normalizeWeeklyStatsForStorage(sanitizeWeeklyStatsInput(r.stats))
      if (Object.keys(statsNorm).length === 0) return null
      return {
        team_id: teamId,
        game_id: gameId,
        player_id: r.playerId,
        stats: statsNorm,
        updated_at: now,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  if (mirrorRows.length > 0) {
    const { error: mirErr } = await supabase.from("player_game_stats").insert(mirrorRows)
    if (mirErr) {
      throw new Error("Failed to write player_game_stats mirror")
    }
  }
}
