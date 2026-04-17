import type { SupabaseClient } from "@supabase/supabase-js"
import {
  VIDEO_TIER_DEFAULTS,
  assertTier,
  type SharedStorageScope,
  type VideoCapabilityTier,
} from "@/lib/video/tier-defaults"

export type EffectiveVideoEntitlements = {
  tier: VideoCapabilityTier
  storageCapBytes: number
  sharedStorageScope: SharedStorageScope
  aiVideoFeaturesEnabled: boolean
  taggingEnabled: boolean
  crossTeamLibraryEnabled: boolean
  bulkManagementEnabled: boolean
  advancedClipToolsEnabled: boolean
  priorityProcessingEnabled: boolean
  maxClips: number | null
}

type ProgramSettingsRow = {
  capability_tier: string
  storage_cap_bytes: number | null
  shared_storage_scope: string
  ai_video_features_enabled: boolean
  tagging_enabled: boolean
  cross_team_library_enabled: boolean
  bulk_management_enabled: boolean
  advanced_clip_tools_enabled: boolean
  priority_processing_enabled: boolean
  max_clips: number | null
}

type TeamSettingsRow = {
  capability_tier: string | null
  storage_cap_bytes: number | null
  shared_storage_scope: string | null
  ai_video_features_enabled: boolean | null
  tagging_enabled: boolean | null
  cross_team_library_enabled: boolean | null
  bulk_management_enabled: boolean | null
  advanced_clip_tools_enabled: boolean | null
  priority_processing_enabled: boolean | null
  max_clips: number | null
}

function mergeBool(base: boolean, override: boolean | null | undefined): boolean {
  return override === null || override === undefined ? base : Boolean(override)
}

function mergeScope(base: SharedStorageScope, override: string | null | undefined): SharedStorageScope {
  if (override === "team" || override === "program") return override
  return base
}

export async function resolveEffectiveVideoEntitlements(
  supabase: SupabaseClient,
  teamId: string
): Promise<EffectiveVideoEntitlements | null> {
  const { data: team, error } = await supabase
    .from("teams")
    .select("id, program_id")
    .eq("id", teamId)
    .maybeSingle()

  if (error || !team) return null

  const programId = (team as { program_id?: string | null }).program_id ?? null

  let programRow: ProgramSettingsRow | null = null
  if (programId) {
    const { data: pr } = await supabase.from("program_video_settings").select("*").eq("program_id", programId).maybeSingle()
    if (pr) programRow = pr as ProgramSettingsRow
  }

  const { data: teamRowRaw } = await supabase.from("team_video_settings").select("*").eq("team_id", teamId).maybeSingle()
  const teamRow = teamRowRaw as TeamSettingsRow | null

  const programTier = programRow ? assertTier(programRow.capability_tier) : ("starter" as VideoCapabilityTier)
  const mergedTier = assertTier(teamRow?.capability_tier ?? programTier)
  const mergedDefaults = VIDEO_TIER_DEFAULTS[mergedTier]

  const storageCapBytes =
    teamRow?.storage_cap_bytes ?? programRow?.storage_cap_bytes ?? mergedDefaults.storageCapBytes

  const sharedStorageScope = mergeScope(
    mergedDefaults.sharedStorageScope,
    teamRow?.shared_storage_scope ?? programRow?.shared_storage_scope
  )

  return {
    tier: mergedTier,
    storageCapBytes,
    sharedStorageScope,
    aiVideoFeaturesEnabled: mergeBool(
      mergedDefaults.aiVideoFeaturesEnabled,
      teamRow?.ai_video_features_enabled ?? programRow?.ai_video_features_enabled
    ),
    taggingEnabled: mergeBool(mergedDefaults.taggingEnabled, teamRow?.tagging_enabled ?? programRow?.tagging_enabled),
    crossTeamLibraryEnabled: mergeBool(
      mergedDefaults.crossTeamLibraryEnabled,
      teamRow?.cross_team_library_enabled ?? programRow?.cross_team_library_enabled
    ),
    bulkManagementEnabled: mergeBool(
      mergedDefaults.bulkManagementEnabled,
      teamRow?.bulk_management_enabled ?? programRow?.bulk_management_enabled
    ),
    advancedClipToolsEnabled: mergeBool(
      mergedDefaults.advancedClipToolsEnabled,
      teamRow?.advanced_clip_tools_enabled ?? programRow?.advanced_clip_tools_enabled
    ),
    priorityProcessingEnabled: mergeBool(
      mergedDefaults.priorityProcessingEnabled,
      teamRow?.priority_processing_enabled ?? programRow?.priority_processing_enabled
    ),
    maxClips:
      teamRow?.max_clips !== null && teamRow?.max_clips !== undefined
        ? teamRow.max_clips
        : programRow?.max_clips !== null && programRow?.max_clips !== undefined
          ? programRow.max_clips
          : mergedDefaults.maxClips,
  }
}
