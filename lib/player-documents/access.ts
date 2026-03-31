import type { SupabaseClient } from "@supabase/supabase-js"
import { ROLES, type Role } from "@/lib/auth/roles"
import { getUserMembership, type UserMembership } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { resolveAthleticDirectorScope, buildAdTeamsOrFilter } from "@/lib/ad-team-scope"

export interface PlayerDocumentAccess {
  userId: string
  /** List + view signed URLs */
  canView: boolean
  /** Player self or linked parent */
  canUpload: boolean
  /** Head coach or AD (scoped) */
  canExport: boolean
  /** Uploader (player/parent), head coach, AD */
  canDelete: boolean
  /** Assistant or head coach — legacy visibility flag */
  canManageVisibility: boolean
  role: Role | null
  membership: UserMembership | null
  isPlayer: boolean
  isParent: boolean
  isHeadCoach: boolean
  isAthleticDirector: boolean
}

export async function isLinkedParentOfPlayer(
  supabase: SupabaseClient,
  userId: string,
  playerId: string
): Promise<boolean> {
  const { data: direct } = await supabase
    .from("parent_player_links")
    .select("id")
    .eq("parent_user_id", userId)
    .eq("player_id", playerId)
    .maybeSingle()
  if (direct) return true

  const { data: guardians } = await supabase.from("guardians").select("id").eq("user_id", userId)
  const gids = (guardians ?? []).map((g) => (g as { id: string }).id).filter(Boolean)
  if (gids.length === 0) return false
  const { count } = await supabase
    .from("guardian_links")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .in("guardian_id", gids)
  return (count ?? 0) > 0
}

export async function isHeadCoachOnTeam(
  supabase: SupabaseClient,
  userId: string,
  teamId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()
  const r = data ? String((data as { role: string }).role).toLowerCase().replace(/-/g, "_") : ""
  return r === "head_coach"
}

async function athleticDirectorCanAccessTeam(
  supabase: SupabaseClient,
  userId: string,
  teamId: string
): Promise<boolean> {
  const scope = await resolveAthleticDirectorScope(supabase, userId)
  const role = String(scope.profileRole ?? "").toLowerCase().replace(/-/g, "_")
  if (role !== "athletic_director") return false
  const orFilter = buildAdTeamsOrFilter(scope)
  if (!orFilter) return false
  const { data } = await supabase.from("teams").select("id").eq("id", teamId).or(orFilter).maybeSingle()
  return Boolean(data?.id)
}

/**
 * Central authorization for player participation documents (server-side).
 * Does not grant access across teams: player.team_id must match `teamId`.
 */
export async function resolvePlayerDocumentAccess(
  supabase: SupabaseClient,
  userId: string,
  playerId: string,
  teamId: string
): Promise<PlayerDocumentAccess | null> {
  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("id, team_id, user_id")
    .eq("id", playerId)
    .eq("team_id", teamId)
    .maybeSingle()

  if (pErr || !player) return null

  const playerUserId = (player as { user_id: string | null }).user_id
  const isPlayer = playerUserId === userId

  let membership: UserMembership | null = null
  try {
    membership = await getUserMembership(teamId)
  } catch {
    membership = null
  }

  const isParent = await isLinkedParentOfPlayer(supabase, userId, playerId)
  const isHc = await isHeadCoachOnTeam(supabase, userId, teamId)
  const isAd = await athleticDirectorCanAccessTeam(supabase, userId, teamId)

  const coachMember = membership && canEditRoster(membership.role)
  const isAssistantOrHeadCoach = Boolean(
    coachMember && membership && (membership.role === ROLES.HEAD_COACH || membership.role === ROLES.ASSISTANT_COACH)
  )

  const isHeadCoachRole = membership?.role === ROLES.HEAD_COACH || isHc

  const base: Omit<PlayerDocumentAccess, "canView" | "canUpload" | "canExport" | "canDelete" | "canManageVisibility"> = {
    userId,
    role: membership?.role ?? null,
    membership,
    isPlayer,
    isParent,
    isHeadCoach: Boolean(isHeadCoachRole),
    isAthleticDirector: isAd,
  }

  // Athletic director (scoped) — after team exists; does not use team_members coach row
  if (isAd) {
    return {
      ...base,
      canView: true,
      canUpload: false,
      canExport: true,
      canDelete: true,
      canManageVisibility: false,
    }
  }

  // Staff on this team: coaches first (same user could also match player row in edge cases)
  if (coachMember && membership && isAssistantOrHeadCoach) {
    const isAssistantOnly = membership.role === ROLES.ASSISTANT_COACH
    return {
      ...base,
      canView: true,
      /** Staff can upload participation documents on behalf of the player from the roster profile. */
      canUpload: true,
      canExport: !isAssistantOnly && isHeadCoachRole,
      canDelete: isHeadCoachRole,
      canManageVisibility: true,
    }
  }

  if (isPlayer) {
    return {
      ...base,
      canView: true,
      canUpload: true,
      canExport: false,
      canDelete: true,
      canManageVisibility: false,
    }
  }

  if (isParent) {
    return {
      ...base,
      canView: true,
      canUpload: true,
      canExport: false,
      canDelete: true,
      canManageVisibility: false,
    }
  }

  return null
}

/** Whether the actor may soft-delete a specific document row (caller verifies row ownership / scope). */
export function canSoftDeleteDocument(
  access: PlayerDocumentAccess,
  row: { uploaded_by_profile_id: string | null; player_id: string },
  playerOwnerUserId: string | null
): boolean {
  if (access.isHeadCoach || access.isAthleticDirector) return true
  if (access.isPlayer && row.uploaded_by_profile_id === access.userId && playerOwnerUserId === access.userId) {
    return true
  }
  if (access.isParent && row.uploaded_by_profile_id === access.userId) return true
  return false
}
