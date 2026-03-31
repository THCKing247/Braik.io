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
 * Org + team must allow the product; user needs at least can_view_video for nav + page shell.
 */
export function effectiveVideoClipsProductEnabled(args: {
  teamVideoClipsEnabled: boolean
  organizationVideoClipsEnabled: boolean | null
}): boolean {
  const orgOk = args.organizationVideoClipsEnabled == null ? true : args.organizationVideoClipsEnabled
  return Boolean(orgOk && args.teamVideoClipsEnabled)
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
): Promise<{ teamVideoClipsEnabled: boolean; organizationVideoClipsEnabled: boolean | null }> {
  const { data: team } = await supabase
    .from("teams")
    .select("id, video_clips_enabled, program_id")
    .eq("id", teamId)
    .maybeSingle()

  if (!team) {
    return { teamVideoClipsEnabled: false, organizationVideoClipsEnabled: null }
  }

  const teamFlag = Boolean((team as { video_clips_enabled?: boolean }).video_clips_enabled)
  const programId = (team as { program_id?: string | null }).program_id
  if (!programId) {
    return { teamVideoClipsEnabled: teamFlag, organizationVideoClipsEnabled: null }
  }

  const { data: program } = await supabase
    .from("programs")
    .select("organization_id")
    .eq("id", programId)
    .maybeSingle()

  const orgId = (program as { organization_id?: string | null } | null)?.organization_id
  if (!orgId) {
    return { teamVideoClipsEnabled: teamFlag, organizationVideoClipsEnabled: null }
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("video_clips_enabled")
    .eq("id", orgId)
    .maybeSingle()

  const orgFlag = (org as { video_clips_enabled?: boolean } | null)?.video_clips_enabled
  return {
    teamVideoClipsEnabled: teamFlag,
    organizationVideoClipsEnabled: orgFlag == null ? null : Boolean(orgFlag),
  }
}
