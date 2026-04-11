import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * User-facing copy when action tools (Coach B+) are disabled.
 * Centralize so chat, APIs, and UI stay consistent.
 */
export const COACH_B_PLUS_UNAVAILABLE_USER_MESSAGE =
  "Coach B can help answer questions and provide recommendations, but action features like creating events, updating rosters, and sending announcements are part of Coach B+, which isn't enabled on this account."

export type CoachBPlusTeamOrgFlags = {
  teamCoachBPlusEnabled: boolean
  /** When the team has no program/org link, null — team flag alone applies. When linked, must be true with team. */
  organizationCoachBPlusEnabled: boolean | null
}

/**
 * Org + team flags: both must allow when an org is linked; standalone teams use the team flag only.
 */
export function effectiveCoachBPlusEnabled(flags: CoachBPlusTeamOrgFlags): boolean {
  if (!flags.teamCoachBPlusEnabled) return false
  if (flags.organizationCoachBPlusEnabled === null) return true
  return flags.organizationCoachBPlusEnabled === true
}

export async function loadTeamOrgCoachBPlusFlags(
  supabase: SupabaseClient,
  teamId: string
): Promise<CoachBPlusTeamOrgFlags> {
  const { data: team } = await supabase
    .from("teams")
    .select("id, coach_b_plus_enabled, program_id")
    .eq("id", teamId)
    .maybeSingle()

  if (!team) {
    return { teamCoachBPlusEnabled: false, organizationCoachBPlusEnabled: null }
  }

  const teamFlag = Boolean((team as { coach_b_plus_enabled?: boolean }).coach_b_plus_enabled)
  const programId = (team as { program_id?: string | null }).program_id

  let organizationCoachBPlusEnabled: boolean | null = null
  if (programId) {
    const { data: program } = await supabase
      .from("programs")
      .select("organization_id")
      .eq("id", programId)
      .maybeSingle()

    const orgId = (program as { organization_id?: string | null } | null)?.organization_id
    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("coach_b_plus_enabled")
        .eq("id", orgId)
        .maybeSingle()
      organizationCoachBPlusEnabled = org
        ? Boolean((org as { coach_b_plus_enabled?: boolean }).coach_b_plus_enabled)
        : false
    }
  }

  return { teamCoachBPlusEnabled: teamFlag, organizationCoachBPlusEnabled }
}

async function loadUserCoachBPlusOverride(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("user_feature_overrides")
    .select("flags")
    .eq("user_id", userId)
    .maybeSingle()
  const flags = (data as { flags?: Record<string, unknown> } | null)?.flags
  if (!flags || typeof flags !== "object") return false
  const v = flags.coach_b_plus
  return v === true || v === "true"
}

function isCoachBPlusDevBypass(): boolean {
  return process.env.NODE_ENV === "development" && process.env.COACH_B_PLUS_DEV === "true"
}

function isCoachBPlusPlatformOwnerBypass(isPlatformOwner?: boolean): boolean {
  return isPlatformOwner === true && process.env.COACH_B_PLUS_PLATFORM_OWNER === "true"
}

/**
 * Whether this user may use Coach B+ action tools for the given team.
 * Checks (in order): dev env bypass, platform-owner bypass (env), user_feature_overrides, then org/team columns.
 */
export async function isCoachBPlusEntitled(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
  opts?: { isPlatformOwner?: boolean }
): Promise<boolean> {
  if (isCoachBPlusDevBypass()) return true
  if (isCoachBPlusPlatformOwnerBypass(opts?.isPlatformOwner)) return true
  if (await loadUserCoachBPlusOverride(supabase, userId)) return true
  const flags = await loadTeamOrgCoachBPlusFlags(supabase, teamId)
  return effectiveCoachBPlusEnabled(flags)
}

/** Preferred name for permission checks at API boundaries. */
export const canUseCoachBPlus = isCoachBPlusEntitled
