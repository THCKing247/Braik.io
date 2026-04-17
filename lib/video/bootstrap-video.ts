import type { SupabaseClient } from "@supabase/supabase-js"
import type { VideoEntitlementSummary } from "@/lib/app/app-bootstrap-types"
import {
  effectiveVideoClipsProductEnabled,
  loadTeamOrgVideoFlags,
  loadUserVideoPermissions,
  resolveVideoClipsNavVisible,
} from "@/lib/video/resolve-video-clips-access"
import { resolveEffectiveVideoEntitlements } from "@/lib/video/entitlements"
import { resolveQuotaBaselineBytes, getTeamRollup } from "@/lib/video/quota"
import type { AppBootstrapVideoClips } from "@/lib/app/app-bootstrap-types"

export async function buildVideoClipsBootstrap(
  supabase: SupabaseClient,
  teamId: string,
  userId: string
): Promise<AppBootstrapVideoClips> {
  const [flags, videoPerms] = await Promise.all([
    loadTeamOrgVideoFlags(supabase, teamId),
    loadUserVideoPermissions(supabase, userId),
  ])

  const productEnabled = effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: flags.teamVideoClipsEnabled,
    organizationVideoClipsEnabled: flags.organizationVideoClipsEnabled,
    athleticDepartmentVideoClipsEnabled: flags.athleticDepartmentVideoClipsEnabled,
  })

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
    navVisible: resolveVideoClipsNavVisible({
      productEnabled,
      canViewVideo: videoPerms.can_view_video,
    }),
    canViewVideo: videoPerms.can_view_video,
    canUploadVideo: videoPerms.can_upload_video,
    canCreateClips: videoPerms.can_create_clips,
    canShareClips: videoPerms.can_share_clips,
    canDeleteVideo: videoPerms.can_delete_video,
    entitlement,
  }
}
