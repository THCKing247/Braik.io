/**
 * Capability defaults per tier — storage budgets and feature gates only (no pricing).
 * Admin/program/team settings may override numeric caps.
 */

export type VideoCapabilityTier = "starter" | "pro" | "elite" | "enterprise"

export type SharedStorageScope = "team" | "program"

export type TierCapabilityDefaults = {
  storageCapBytes: number
  /** null = unlimited clips */
  maxClips: number | null
  aiVideoFeaturesEnabled: boolean
  taggingEnabled: boolean
  crossTeamLibraryEnabled: boolean
  bulkManagementEnabled: boolean
  advancedClipToolsEnabled: boolean
  priorityProcessingEnabled: boolean
  sharedStorageScope: SharedStorageScope
}

const GB = 1024 * 1024 * 1024

export const VIDEO_TIER_DEFAULTS: Record<VideoCapabilityTier, TierCapabilityDefaults> = {
  starter: {
    storageCapBytes: 10 * GB,
    maxClips: 200,
    aiVideoFeaturesEnabled: true,
    taggingEnabled: false,
    crossTeamLibraryEnabled: false,
    bulkManagementEnabled: false,
    advancedClipToolsEnabled: false,
    priorityProcessingEnabled: false,
    sharedStorageScope: "team",
  },
  pro: {
    storageCapBytes: 100 * GB,
    maxClips: 1000,
    aiVideoFeaturesEnabled: true,
    taggingEnabled: true,
    crossTeamLibraryEnabled: false,
    bulkManagementEnabled: false,
    advancedClipToolsEnabled: true,
    priorityProcessingEnabled: false,
    sharedStorageScope: "team",
  },
  elite: {
    storageCapBytes: 1024 * GB,
    maxClips: null,
    aiVideoFeaturesEnabled: true,
    taggingEnabled: true,
    crossTeamLibraryEnabled: false,
    bulkManagementEnabled: false,
    advancedClipToolsEnabled: true,
    priorityProcessingEnabled: true,
    sharedStorageScope: "team",
  },
  enterprise: {
    storageCapBytes: 5 * 1024 * GB,
    maxClips: null,
    aiVideoFeaturesEnabled: true,
    taggingEnabled: true,
    crossTeamLibraryEnabled: true,
    bulkManagementEnabled: true,
    advancedClipToolsEnabled: true,
    priorityProcessingEnabled: true,
    sharedStorageScope: "program",
  },
}

export function assertTier(raw: string | null | undefined): VideoCapabilityTier {
  const v = String(raw ?? "starter").toLowerCase()
  if (v === "starter" || v === "pro" || v === "elite" || v === "enterprise") return v
  return "starter"
}
