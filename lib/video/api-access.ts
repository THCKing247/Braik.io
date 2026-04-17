import type { SupabaseClient } from "@supabase/supabase-js"
import {
  effectiveVideoClipsProductEnabled,
  loadUserVideoPermissions,
  resolvePortalTeamOrgVideoFlags,
  type UserVideoPermissionsRow,
} from "@/lib/video/resolve-video-clips-access"

export type VideoGateResult =
  | {
      ok: true
      flags: Awaited<ReturnType<typeof resolvePortalTeamOrgVideoFlags>>
      perms: UserVideoPermissionsRow
      productEnabled: boolean
    }
  | { ok: false; status: number; message: string }

export type VideoGateAuthContext = {
  portalRole?: string | null
  isPlatformOwner?: boolean
}

export async function gateGameVideoTeamApi(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  needs: Partial<{
    view: boolean
    upload: boolean
    createClip: boolean
    shareClip: boolean
    deleteVideo: boolean
  }>,
  auth?: VideoGateAuthContext
): Promise<VideoGateResult> {
  const [flags, perms] = await Promise.all([
    resolvePortalTeamOrgVideoFlags(supabase, teamId),
    loadUserVideoPermissions(supabase, userId, {
      portalRole: auth?.portalRole,
      isPlatformOwner: auth?.isPlatformOwner,
    }),
  ])

  const productEnabled = effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: flags.teamVideoClipsEnabled,
    organizationVideoClipsEnabled: flags.organizationVideoClipsEnabled,
    athleticDepartmentVideoClipsEnabled: flags.athleticDepartmentVideoClipsEnabled,
  })

  if (!productEnabled) {
    return { ok: false, status: 403, message: "Video features are not enabled for this team." }
  }

  if (needs.view && !perms.can_view_video) {
    return { ok: false, status: 403, message: "Forbidden" }
  }
  if (needs.upload && !perms.can_upload_video) {
    return { ok: false, status: 403, message: "Forbidden" }
  }
  if (needs.createClip && !perms.can_create_clips) {
    return { ok: false, status: 403, message: "Forbidden" }
  }
  if (needs.shareClip && !perms.can_share_clips) {
    return { ok: false, status: 403, message: "Forbidden" }
  }
  if (needs.deleteVideo && !perms.can_delete_video) {
    return { ok: false, status: 403, message: "Forbidden" }
  }

  return { ok: true, flags, perms, productEnabled }
}
