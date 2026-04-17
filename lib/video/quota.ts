import type { SupabaseClient } from "@supabase/supabase-js"
import type { EffectiveVideoEntitlements } from "@/lib/video/entitlements"

export type StorageUsageSnapshot = {
  usedBytes: number
  videoCount: number
  clipCount: number
}

export async function getTeamRollup(supabase: SupabaseClient, teamId: string): Promise<StorageUsageSnapshot> {
  const { data } = await supabase
    .from("video_storage_rollups")
    .select("bytes_used, video_count, clip_count")
    .eq("team_id", teamId)
    .maybeSingle()

  if (!data) {
    return { usedBytes: 0, videoCount: 0, clipCount: 0 }
  }

  const row = data as { bytes_used?: number; video_count?: number; clip_count?: number }
  return {
    usedBytes: Number(row.bytes_used ?? 0),
    videoCount: Number(row.video_count ?? 0),
    clipCount: Number(row.clip_count ?? 0),
  }
}

export async function sumProgramTeamsUsedBytes(supabase: SupabaseClient, programId: string): Promise<number> {
  const { data: teams } = await supabase.from("teams").select("id").eq("program_id", programId)
  const ids = (teams ?? []).map((t: { id: string }) => t.id)
  if (ids.length === 0) return 0

  let total = 0
  for (const tid of ids) {
    const r = await getTeamRollup(supabase, tid)
    total += r.usedBytes
  }
  return total
}

/** Effective bytes counted against quota for an upload coming to `teamId`. */
export async function resolveQuotaBaselineBytes(
  supabase: SupabaseClient,
  teamId: string,
  programId: string | null,
  entitlements: EffectiveVideoEntitlements
): Promise<{ usedBytes: number; capBytes: number }> {
  const capBytes = entitlements.storageCapBytes
  if (entitlements.sharedStorageScope === "program" && programId) {
    const usedBytes = await sumProgramTeamsUsedBytes(supabase, programId)
    return { usedBytes, capBytes }
  }
  const rollup = await getTeamRollup(supabase, teamId)
  return { usedBytes: rollup.usedBytes, capBytes }
}

export function wouldExceedQuota(usedBytes: number, capBytes: number, additionalBytes: number): boolean {
  return usedBytes + additionalBytes > capBytes
}

export async function adjustRollupAfterUploadComplete(
  supabase: SupabaseClient,
  teamId: string,
  addedBytes: number
): Promise<void> {
  const cur = await getTeamRollup(supabase, teamId)
  await supabase.from("video_storage_rollups").upsert(
    {
      team_id: teamId,
      bytes_used: Math.max(0, cur.usedBytes + addedBytes),
      video_count: Math.max(0, cur.videoCount + 1),
      clip_count: cur.clipCount,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "team_id" }
  )
}

export async function adjustRollupAfterVideoDelete(
  supabase: SupabaseClient,
  teamId: string,
  removedBytes: number
): Promise<void> {
  const cur = await getTeamRollup(supabase, teamId)
  await supabase
    .from("video_storage_rollups")
    .update({
      bytes_used: Math.max(0, cur.usedBytes - removedBytes),
      video_count: Math.max(0, cur.videoCount - 1),
      updated_at: new Date().toISOString(),
    })
    .eq("team_id", teamId)
}

export async function incrementClipRollup(supabase: SupabaseClient, teamId: string, delta: 1 | -1): Promise<void> {
  const cur = await getTeamRollup(supabase, teamId)
  const newClips = Math.max(0, cur.clipCount + delta)
  await supabase.from("video_storage_rollups").upsert(
    {
      team_id: teamId,
      bytes_used: cur.usedBytes,
      video_count: cur.videoCount,
      clip_count: newClips,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "team_id" }
  )
}
