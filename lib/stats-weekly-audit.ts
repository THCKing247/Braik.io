import type { SupabaseClient } from "@supabase/supabase-js"

export type WeeklyStatAuditAction = "create" | "update" | "soft_delete" | "restore"

export type WeeklyEntryAuditSnapshot = Record<string, unknown>

export async function insertWeeklyStatEntryAudit(
  supabase: SupabaseClient,
  row: {
    entryId: string
    teamId: string
    action: WeeklyStatAuditAction
    beforeData: WeeklyEntryAuditSnapshot | null
    afterData: WeeklyEntryAuditSnapshot | null
    actedBy: string | null
  }
): Promise<void> {
  const { error } = await supabase.from("player_weekly_stat_entry_audit").insert({
    entry_id: row.entryId,
    team_id: row.teamId,
    action: row.action,
    before_data: row.beforeData,
    after_data: row.afterData,
    acted_by: row.actedBy,
  })
  if (error) {
    console.error("[insertWeeklyStatEntryAudit]", error)
  }
}

export function weeklyEntryRowToAuditSnapshot(raw: Record<string, unknown>): WeeklyEntryAuditSnapshot {
  return {
    id: raw.id,
    team_id: raw.team_id,
    player_id: raw.player_id,
    season_year: raw.season_year,
    week_number: raw.week_number,
    game_id: raw.game_id,
    opponent: raw.opponent,
    game_date: raw.game_date,
    game_type: raw.game_type,
    location: raw.location,
    venue: raw.venue,
    result: raw.result,
    team_score: raw.team_score,
    opponent_score: raw.opponent_score,
    notes: raw.notes,
    stats: raw.stats,
    created_at: raw.created_at,
    created_by: raw.created_by,
    updated_at: raw.updated_at,
    updated_by: raw.updated_by,
    deleted_at: raw.deleted_at,
    deleted_by: raw.deleted_by,
  }
}
