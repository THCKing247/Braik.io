import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * Get player IDs that a parent user can access via guardian links.
 */
export async function getParentAccessiblePlayerIds(userId: string, teamId: string): Promise<string[]> {
  const supabase = getSupabaseServer()

  // Get guardian record for this user
  const { data: guardian } = await supabase
    .from("guardians")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (!guardian) {
    return []
  }

  // Get guardian links for this team's players
  const { data: links } = await supabase
    .from("guardian_links")
    .select("player_id")
    .eq("guardian_id", guardian.id)

  if (!links || links.length === 0) {
    return []
  }

  const playerIds = links.map((l) => l.player_id)

  // Verify players belong to the team
  const { data: players } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", teamId)
    .in("id", playerIds)

  return (players ?? []).map((p) => p.id)
}

export function getAssistantCoachPositionGroups(positionGroups: any): string[] | null {
  if (!positionGroups || !Array.isArray(positionGroups)) {
    return null
  }
  return positionGroups
}

export function canAssistantCoachAccessPlayer(
  playerPositionGroup: string | null,
  assistantPositionGroups: string[] | null
): boolean {
  if (!assistantPositionGroups || assistantPositionGroups.length === 0) {
    return true
  }
  if (!playerPositionGroup) {
    return false
  }
  return assistantPositionGroups.includes(playerPositionGroup)
}

/**
 * Build a Supabase filter for players based on user role and permissions.
 * Returns filter object that can be used with .filter() or query builder.
 */
export async function buildPlayerFilter(
  userId: string,
  role: string,
  teamId: string,
  positionGroups?: string[] | null
): Promise<any> {
  const supabase = getSupabaseServer()

  // Head coaches and admins can see all players
  if (role === "head_coach" || role === "admin") {
    return { team_id: teamId }
  }

  // Parents can only see their linked players
  if (role === "parent") {
    const accessiblePlayerIds = await getParentAccessiblePlayerIds(userId, teamId)
    if (accessiblePlayerIds.length === 0) {
      return { team_id: teamId, id: "00000000-0000-0000-0000-000000000000" } // No access
    }
    return { team_id: teamId, id: { in: accessiblePlayerIds } }
  }

  // Assistant coaches can see players in their position groups
  if (role === "assistant_coach") {
    if (!positionGroups || positionGroups.length === 0) {
      // No position group restriction - can see all
      return { team_id: teamId }
    }
    return { team_id: teamId, position_group: { in: positionGroups } }
  }

  // Players can only see themselves
  if (role === "player") {
    // Get player record for this user
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle()

    if (!player) {
      return { team_id: teamId, id: "00000000-0000-0000-0000-000000000000" } // No access
    }
    return { team_id: teamId, id: player.id }
  }

  // Default: no access
  return { team_id: teamId, id: "00000000-0000-0000-0000-000000000000" }
}
