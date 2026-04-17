import type { SupabaseClient } from "@supabase/supabase-js"
import type { VideoEntitlementSummary } from "@/lib/app/app-bootstrap-types"
import {
  effectiveVideoClipsProductEnabled,
  loadUserVideoPermissions,
  resolvePortalTeamOrgVideoFlags,
  resolveVideoClipsNavVisible,
} from "@/lib/video/resolve-video-clips-access"
import { resolveEffectiveVideoEntitlements } from "@/lib/video/entitlements"
import { resolveQuotaBaselineBytes, getTeamRollup } from "@/lib/video/quota"
import type { AppBootstrapVideoClips } from "@/lib/app/app-bootstrap-types"

export async function buildVideoClipsBootstrap(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
  ctx: { portalRole: string; isPlatformOwner?: boolean }
): Promise<AppBootstrapVideoClips> {
  const [flags, videoPerms] = await Promise.all([
    resolvePortalTeamOrgVideoFlags(supabase, teamId),
    loadUserVideoPermissions(supabase, userId, {
      portalRole: ctx.portalRole,
      isPlatformOwner: ctx.isPlatformOwner,
    }),
  ])

  const productEnabled = effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: flags.teamVideoClipsEnabled,
    organizationVideoClipsEnabled: flags.organizationVideoClipsEnabled,
    athleticDepartmentVideoClipsEnabled: flags.athleticDepartmentVideoClipsEnabled,
  })

  const navVisible = resolveVideoClipsNavVisible({
    productEnabled,
    canViewVideo: videoPerms.can_view_video,
  })

  let disableHint: string | null = null
  if (!navVisible) {
    if (!productEnabled) {
      disableHint =
        "Game Video is turned off for this team or school (team / organization / athletic department settings). Enable it in Braik admin or school settings, or set BRAIK_VIDEO_DEV_DEFAULTS=true locally for development."
    } else if (!videoPerms.can_view_video) {
      disableHint =
        "Your account does not have permission to view game video. Ask an administrator to grant video access for your user."
    }
  }

  let entitlement: VideoEntitlementSummary | undefined
  if (productEnabled && videoPerms.can_view_video) {
    const ent = await resolveEffectiveVideoEntitlements(supabase, teamId)
    const { data: teamMeta } = await supabase.from("teams").select("program_id").eq("id", teamId).maybeSingle()
    const programId = (teamMeta as { program_id?: string | null } | null)?.program_id ?? null
    if (ent) {
      const baseline = await resolveQuotaBaselineBytes(supabase, teamId, programId, ent)
      const rollup = await getTeamRollup(supabase, teamId)
      entitlement = {
        tier: ent.tier,
        storageCapBytes: baseline.capBytes,
        storageUsedBytes: baseline.usedBytes,
        teamUsedBytes: rollup.usedBytes,
        videoCount: rollup.videoCount,
        clipCount: rollup.clipCount,
        aiVideoEnabled: ent.aiVideoFeaturesEnabled,
        taggingEnabled: ent.taggingEnabled,
        crossTeamLibraryEnabled: ent.crossTeamLibraryEnabled,
        bulkManagementEnabled: ent.bulkManagementEnabled,
        advancedClipTools: ent.advancedClipToolsEnabled,
        sharedStorageScope: ent.sharedStorageScope,
      }
    }
  }

  return {
    productEnabled,
    navVisible,
    canViewVideo: videoPerms.can_view_video,
    canUploadVideo: videoPerms.can_upload_video,
    canCreateClips: videoPerms.can_create_clips,
    canShareClips: videoPerms.can_share_clips,
    canDeleteVideo: videoPerms.can_delete_video,
    entitlement,
    disableHint,
  }
}
