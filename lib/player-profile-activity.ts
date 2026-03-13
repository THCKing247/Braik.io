/**
 * Player profile activity logging. Central place for recording profile-related events.
 * Use this so future notifications and audit reports can hook in without rework.
 *
 * NOTIFICATION_INTEGRATION: Use payloads from buildProfileEventPayload() when calling
 * createNotifications() so player, coach, and guardian targets get consistent event data.
 */

import { getSupabaseServer } from "@/src/lib/supabaseServer"

/** Centralized event payload shape for activity + future notifications. */
export interface PlayerProfileEventPayload {
  playerId: string
  teamId: string
  actionType: PlayerProfileActionType
  actorId: string | null
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
  /** Resolve for notifications: player's user_id for in-app target. */
  playerUserId?: string | null
  /** Resolve for notifications: guardian user_ids from guardian_links for this player. */
  guardianUserIds?: string[]
}

export const PLAYER_PROFILE_ACTION_TYPES = {
  PHOTO_CHANGED: "photo_changed",
  PHOTO_REMOVED: "photo_removed",
  PROFILE_UPDATED: "profile_updated",
  EQUIPMENT_ASSIGNED: "equipment_assigned",
  EQUIPMENT_UNASSIGNED: "equipment_unassigned",
  DOCUMENT_UPLOADED: "document_uploaded",
  DOCUMENT_DELETED: "document_deleted",
  STATS_UPDATED: "stats_updated",
  FOLLOW_UP_CREATED: "follow_up_created",
  FOLLOW_UP_RESOLVED: "follow_up_resolved",
} as const

export type PlayerProfileActionType = (typeof PLAYER_PROFILE_ACTION_TYPES)[keyof typeof PLAYER_PROFILE_ACTION_TYPES]

export interface LogPlayerProfileActivityParams {
  playerId: string
  teamId: string
  actorId: string | null
  actionType: PlayerProfileActionType
  targetType?: string | null
  targetId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Log a player profile activity event. No-op on insert failure (e.g. table missing).
 *
 * NOTIFICATION_HOOK: Call createNotifications() here for relevant action types:
 * - profile_updated / stats_updated -> notify player (and optionally linked guardians)
 * - document_uploaded -> notify player if visible_to_player
 * - equipment_assigned / equipment_unassigned -> notify player
 * - photo_changed / photo_removed -> optional player notification
 * Resolve player.user_id for target; for guardians use guardian_links to get user_ids.
 */
/** Build a consistent event payload for activity log and notification hooks. */
export function buildProfileEventPayload(params: LogPlayerProfileActivityParams): PlayerProfileEventPayload {
  const { playerId, teamId, actorId, actionType, targetType, targetId, metadata } = params
  return {
    playerId,
    teamId,
    actionType,
    actorId,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    metadata: metadata ?? undefined,
  }
}

export async function logPlayerProfileActivity(params: LogPlayerProfileActivityParams): Promise<void> {
  const { playerId, teamId, actorId, actionType, targetType, targetId, metadata } = params
  const supabase = getSupabaseServer()
  const { error } = await supabase.from("player_profile_activity").insert({
    player_id: playerId,
    team_id: teamId,
    actor_id: actorId ?? null,
    action_type: actionType,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    metadata_json: metadata ?? {},
  })
  if (error) {
    console.warn("[player-profile-activity]", error.message)
  }
  // NOTIFICATION_INTEGRATION: Here, resolve playerUserId (from players.user_id) and
  // guardianUserIds (from guardian_links + guardians.user_id), then call
  // createNotifications({ ...payload, targetUserIds: [playerUserId, ...guardianUserIds] })
  // for relevant action types.
}
