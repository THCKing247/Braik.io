import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * User-facing copy when Coach B+ (actions + voice + mic) is disabled.
 */
export const COACH_B_PLUS_UNAVAILABLE_USER_MESSAGE =
  "Coach B can help answer questions and provide recommendations, but action, voice, and hands-free features are part of Coach B+, which isn't enabled on this account."

/**
 * Same hierarchy as Game Video / Clips: AD (when linked) ∧ org (when linked) ∧ team.
 * @see effectiveVideoClipsProductEnabled in lib/video/resolve-video-clips-access.ts
 */
export function effectiveCoachBPlusProductEnabled(args: {
  teamCoachBPlusEnabled: boolean
  organizationCoachBPlusEnabled: boolean | null
  athleticDepartmentCoachBPlusEnabled?: boolean | null
}): boolean {
  const adOk =
    args.athleticDepartmentCoachBPlusEnabled == null ? true : args.athleticDepartmentCoachBPlusEnabled
  const orgOk = args.organizationCoachBPlusEnabled == null ? true : args.organizationCoachBPlusEnabled
  return Boolean(adOk && orgOk && args.teamCoachBPlusEnabled)
}

export type CoachBPlusTeamOrgFlags = {
  teamCoachBPlusEnabled: boolean
  organizationCoachBPlusEnabled: boolean | null
  athleticDepartmentCoachBPlusEnabled: boolean | null
}

/**
 * Loads team, organization (via program), and athletic department flags — mirrors loadTeamOrgVideoFlags.
 */
export async function loadTeamOrgCoachBPlusFlags(
  supabase: SupabaseClient,
  teamId: string
): Promise<CoachBPlusTeamOrgFlags> {
  const { data: team } = await supabase
    .from("teams")
    .select("id, coach_b_plus_enabled, program_id, athletic_department_id")
    .eq("id", teamId)
    .maybeSingle()

  if (!team) {
    return {
      teamCoachBPlusEnabled: false,
      organizationCoachBPlusEnabled: null,
      athleticDepartmentCoachBPlusEnabled: null,
    }
  }

  const teamFlag = Boolean((team as { coach_b_plus_enabled?: boolean }).coach_b_plus_enabled)
  const programId = (team as { program_id?: string | null }).program_id
  const teamAdId = (team as { athletic_department_id?: string | null }).athletic_department_id

  let organizationCoachBPlusEnabled: boolean | null = null
  let orgAthleticDepartmentId: string | null = null

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
        .select("coach_b_plus_enabled, athletic_department_id")
        .eq("id", orgId)
        .maybeSingle()

      if (org) {
        const raw = (org as { coach_b_plus_enabled?: boolean | null }).coach_b_plus_enabled
        organizationCoachBPlusEnabled = raw == null ? null : Boolean(raw)
        orgAthleticDepartmentId = (org as { athletic_department_id?: string | null }).athletic_department_id ?? null
      }
    }
  }

  const resolvedAdId = teamAdId ?? orgAthleticDepartmentId
  let athleticDepartmentCoachBPlusEnabled: boolean | null = null
  if (resolvedAdId) {
    const { data: ad } = await supabase
      .from("athletic_departments")
      .select("coach_b_plus_enabled")
      .eq("id", resolvedAdId)
      .maybeSingle()
    if (ad) {
      athleticDepartmentCoachBPlusEnabled = Boolean(
        (ad as { coach_b_plus_enabled?: boolean }).coach_b_plus_enabled
      )
    }
  }

  return {
    teamCoachBPlusEnabled: teamFlag,
    organizationCoachBPlusEnabled,
    athleticDepartmentCoachBPlusEnabled,
  }
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
 * Whether this user may use Coach B+ (actions + voice + mic) for the given team.
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
  return effectiveCoachBPlusProductEnabled(flags)
}

export const canUseCoachBPlus = isCoachBPlusEntitled

/** @alias isCoachBPlusEntitled */
export const isCoachBPlusEnabled = isCoachBPlusEntitled
