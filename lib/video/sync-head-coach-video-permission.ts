import type { SupabaseClient } from "@supabase/supabase-js"
import { loadStaffRowsForTeams } from "@/lib/admin/athletic-departments-scope"
import { pickHeadCoachUserId } from "@/lib/team-staff"
import {
  effectiveVideoClipsProductEnabled,
  loadTeamOrgVideoFlags,
} from "@/lib/video/resolve-video-clips-access"

function devVideoSyncLog(event: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return
  console.info(`[video-perm-sync] ${event}`, payload)
}

/**
 * Head coach for roster purposes: active head_coach in team_members, else teams.head_coach_user_id.
 */
export async function resolveHeadCoachUserIdForTeam(
  supabase: SupabaseClient,
  teamId: string
): Promise<string | null> {
  const staffMap = await loadStaffRowsForTeams(supabase, [teamId])
  const fromMembers = pickHeadCoachUserId(staffMap.get(teamId) ?? [])
  if (fromMembers) return fromMembers

  const { data: team } = await supabase
    .from("teams")
    .select("head_coach_user_id")
    .eq("id", teamId)
    .maybeSingle()
  const hc = (team as { head_coach_user_id?: string | null } | null)?.head_coach_user_id
  return typeof hc === "string" && hc.trim().length > 0 ? hc.trim() : null
}

export type SyncHeadCoachVideoViewPermissionResult =
  | {
      ok: true
      teamId: string
      headCoachUserId: string
      action: "inserted" | "updated" | "unchanged"
    }
  | {
      ok: false
      teamId: string
      reason: "team_not_found" | "product_not_enabled" | "no_head_coach"
    }

type VideoPermRow = {
  can_view_video?: boolean | null
  can_upload_video?: boolean | null
  can_create_clips?: boolean | null
  can_share_clips?: boolean | null
  can_delete_video?: boolean | null
}

/**
 * If Game Video / Clips is product-enabled for the team, ensure the head coach has
 * user_video_permissions.can_view_video = true (upsert; preserves other permission columns).
 */
export async function syncHeadCoachVideoViewPermissionForTeam(
  supabase: SupabaseClient,
  teamId: string
): Promise<SyncHeadCoachVideoViewPermissionResult> {
  const { data: teamRow } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
  if (!teamRow) {
    devVideoSyncLog("skip", { teamId, reason: "team_not_found" })
    return { ok: false, teamId, reason: "team_not_found" }
  }

  const videoFlags = await loadTeamOrgVideoFlags(supabase, teamId)
  const productEnabled = effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: videoFlags.teamVideoClipsEnabled,
    organizationVideoClipsEnabled: videoFlags.organizationVideoClipsEnabled,
    athleticDepartmentVideoClipsEnabled: videoFlags.athleticDepartmentVideoClipsEnabled,
  })
  if (!productEnabled) {
    devVideoSyncLog("skip", { teamId, reason: "product_not_enabled", flags: videoFlags })
    return { ok: false, teamId, reason: "product_not_enabled" }
  }

  const headCoachUserId = await resolveHeadCoachUserIdForTeam(supabase, teamId)
  if (!headCoachUserId) {
    devVideoSyncLog("skip", { teamId, reason: "no_head_coach" })
    return { ok: false, teamId, reason: "no_head_coach" }
  }

  const { data: existingRaw, error: loadErr } = await supabase
    .from("user_video_permissions")
    .select("can_view_video, can_upload_video, can_create_clips, can_share_clips, can_delete_video")
    .eq("user_id", headCoachUserId)
    .maybeSingle()
  if (loadErr) {
    devVideoSyncLog("error", { teamId, headCoachUserId, message: loadErr.message })
    throw loadErr
  }
  const existing = existingRaw as VideoPermRow | null

  if (existing?.can_view_video === true) {
    devVideoSyncLog("unchanged", { teamId, headCoachUserId })
    return { ok: true, teamId, headCoachUserId, action: "unchanged" }
  }

  const nextRow = {
    user_id: headCoachUserId,
    can_view_video: true,
    can_upload_video: Boolean(existing?.can_upload_video),
    can_create_clips: Boolean(existing?.can_create_clips),
    can_share_clips: Boolean(existing?.can_share_clips),
    can_delete_video: Boolean(existing?.can_delete_video),
    updated_at: new Date().toISOString(),
  }

  const { error: upErr } = await supabase.from("user_video_permissions").upsert(nextRow, { onConflict: "user_id" })
  if (upErr) {
    devVideoSyncLog("error", { teamId, headCoachUserId, message: upErr.message })
    throw upErr
  }

  const action = existing ? "updated" : "inserted"
  devVideoSyncLog(action, { teamId, headCoachUserId })
  return { ok: true, teamId, headCoachUserId, action }
}

/** After org-level video is enabled, attempt HC view sync for each team on a program in that org. */
export async function syncHeadCoachVideoViewForOrganizationTeams(
  supabase: SupabaseClient,
  organizationId: string
): Promise<void> {
  const { data: programs } = await supabase.from("programs").select("id").eq("organization_id", organizationId)
  const pids = [...new Set((programs ?? []).map((p) => (p as { id: string }).id))]
  if (pids.length === 0) return

  const { data: teams } = await supabase.from("teams").select("id").in("program_id", pids)
  for (const t of teams ?? []) {
    const tid = (t as { id: string }).id
    try {
      await syncHeadCoachVideoViewPermissionForTeam(supabase, tid)
    } catch (e) {
      devVideoSyncLog("batch_error", { organizationId, teamId: tid, message: e instanceof Error ? e.message : String(e) })
    }
  }
}
