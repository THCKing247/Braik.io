import type { SupabaseClient } from "@supabase/supabase-js"

export type UserVideoPermissionsRow = {
  can_view_video: boolean
  can_upload_video: boolean
  can_create_clips: boolean
  can_share_clips: boolean
  can_delete_video: boolean
}

const defaultPerms: UserVideoPermissionsRow = {
  can_view_video: false,
  can_upload_video: false,
  can_create_clips: false,
  can_share_clips: false,
  can_delete_video: false,
}

/**
 * Athletic department (when linked) + org + team must allow the product; user needs at least can_view_video for nav + page shell.
 * If no AD is linked, the AD gate is skipped (null).
 */
export function effectiveVideoClipsProductEnabled(args: {
  teamVideoClipsEnabled: boolean
  organizationVideoClipsEnabled: boolean | null
  athleticDepartmentVideoClipsEnabled?: boolean | null
}): boolean {
  const adOk =
    args.athleticDepartmentVideoClipsEnabled == null ? true : args.athleticDepartmentVideoClipsEnabled
  const orgOk = args.organizationVideoClipsEnabled == null ? true : args.organizationVideoClipsEnabled
  return Boolean(adOk && orgOk && args.teamVideoClipsEnabled)
}

export function resolveVideoClipsNavVisible(args: {
  productEnabled: boolean
  canViewVideo: boolean
}): boolean {
  return Boolean(args.productEnabled && args.canViewVideo)
}

export async function loadUserVideoPermissions(
  supabase: SupabaseClient,
  userId: string
): Promise<UserVideoPermissionsRow> {
  const { data } = await supabase
    .from("user_video_permissions")
    .select(
      "can_view_video, can_upload_video, can_create_clips, can_share_clips, can_delete_video"
    )
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return { ...defaultPerms }
  return {
    can_view_video: Boolean(data.can_view_video),
    can_upload_video: Boolean(data.can_upload_video),
    can_create_clips: Boolean(data.can_create_clips),
    can_share_clips: Boolean(data.can_share_clips),
    can_delete_video: Boolean(data.can_delete_video),
  }
}

export async function loadTeamOrgVideoFlags(
  supabase: SupabaseClient,
  teamId: string
): Promise<{
  teamVideoClipsEnabled: boolean
  organizationVideoClipsEnabled: boolean | null
  athleticDepartmentVideoClipsEnabled: boolean | null
}> {
  const { data: team } = await supabase
    .from("teams")
    .select("id, video_clips_enabled, program_id, athletic_department_id")
    .eq("id", teamId)
    .maybeSingle()

  if (!team) {
    return {
      teamVideoClipsEnabled: false,
      organizationVideoClipsEnabled: null,
      athleticDepartmentVideoClipsEnabled: null,
    }
  }

  const teamFlag = Boolean((team as { video_clips_enabled?: boolean }).video_clips_enabled)
  const programId = (team as { program_id?: string | null }).program_id
  const teamAdId = (team as { athletic_department_id?: string | null }).athletic_department_id

  let organizationVideoClipsEnabled: boolean | null = null
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
        .select("video_clips_enabled, athletic_department_id")
        .eq("id", orgId)
        .maybeSingle()

      if (org) {
        const raw = (org as { video_clips_enabled?: boolean | null }).video_clips_enabled
        organizationVideoClipsEnabled = raw == null ? null : Boolean(raw)
        orgAthleticDepartmentId = (org as { athletic_department_id?: string | null }).athletic_department_id ?? null
      }
    }
  }

  const resolvedAdId = teamAdId ?? orgAthleticDepartmentId
  let athleticDepartmentVideoClipsEnabled: boolean | null = null
  if (resolvedAdId) {
    const { data: ad } = await supabase
      .from("athletic_departments")
      .select("video_clips_enabled")
      .eq("id", resolvedAdId)
      .maybeSingle()
    if (ad) {
      athleticDepartmentVideoClipsEnabled = Boolean(
        (ad as { video_clips_enabled?: boolean }).video_clips_enabled
      )
    }
  }

  return {
    teamVideoClipsEnabled: teamFlag,
    organizationVideoClipsEnabled,
    athleticDepartmentVideoClipsEnabled,
  }
}
