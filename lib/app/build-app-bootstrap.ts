import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { UserMembership } from "@/lib/auth/rbac"
import {
  canEditRoster,
  canManageTeam,
  canPostAnnouncements,
  canViewPayments,
} from "@/lib/auth/roles"
import { isHeadCoachRole } from "@/lib/team-staff"
import { getUnreadNotificationCount } from "@/lib/utils/notifications"
import { loadEngagementHintCounts } from "@/lib/engagement/dashboard-hints-data"
import type { AppBootstrapPayload, AppBootstrapTeamFlags, AppBootstrapVideoClips } from "@/lib/app/app-bootstrap-types"
import {
  effectiveVideoClipsProductEnabled,
  loadTeamOrgVideoFlags,
  loadUserVideoPermissions,
  resolveVideoClipsNavVisible,
} from "@/lib/video/resolve-video-clips-access"
import { syncHeadCoachVideoViewPermissionForTeam } from "@/lib/video/sync-head-coach-video-permission"

const ENGAGEMENT_ROLES = new Set(["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"])

async function buildVideoClipsSection(
  supabase: SupabaseClient,
  args: {
    userId: string
    teamId: string
    videoFlags: Awaited<ReturnType<typeof loadTeamOrgVideoFlags>>
    videoPerms: Awaited<ReturnType<typeof loadUserVideoPermissions>>
  }
): Promise<AppBootstrapVideoClips> {
  const productEnabled = effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: args.videoFlags.teamVideoClipsEnabled,
    organizationVideoClipsEnabled: args.videoFlags.organizationVideoClipsEnabled,
    athleticDepartmentVideoClipsEnabled: args.videoFlags.athleticDepartmentVideoClipsEnabled,
  })

  let perms = args.videoPerms
  if (productEnabled && !perms.can_view_video) {
    const { data: membership } = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", args.teamId)
      .eq("user_id", args.userId)
      .eq("active", true)
      .maybeSingle()
    const role = (membership as { role?: string } | null)?.role
    if (role && isHeadCoachRole(role)) {
      try {
        const syncResult = await syncHeadCoachVideoViewPermissionForTeam(supabase, args.teamId)
        if (syncResult.ok && syncResult.headCoachUserId === args.userId) {
          perms = await loadUserVideoPermissions(supabase, args.userId)
        }
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[video-perm-sync] bootstrap self-heal failed", {
            teamId: args.teamId,
            userId: args.userId,
            err: e instanceof Error ? e.message : String(e),
          })
        }
      }
    }
  }

  return {
    productEnabled,
    navVisible: resolveVideoClipsNavVisible({
      productEnabled,
      canViewVideo: perms.can_view_video,
    }),
    canViewVideo: perms.can_view_video,
    canUploadVideo: perms.can_upload_video,
    canCreateClips: perms.can_create_clips,
    canShareClips: perms.can_share_clips,
    canDeleteVideo: perms.can_delete_video,
  }
}

/** Shell for first paint — skips engagement hint counts (hints card fetches `/api/engagement/hints` when needed). */
export async function buildAppBootstrapPayloadLite(input: {
  userId: string
  email: string
  teamId: string
  liteTeamId: string | undefined
  liteRole: string
  isPlatformOwner: boolean
  membership: UserMembership
}): Promise<AppBootstrapPayload> {
  const supabase = getSupabaseServer()

  const [profileRes, teamRes, unread, videoFlags, videoPerms] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", input.userId).maybeSingle(),
    supabase.from("teams").select("id, name, logo_url").eq("id", input.teamId).maybeSingle(),
    getUnreadNotificationCount(input.userId, input.teamId),
    loadTeamOrgVideoFlags(supabase, input.teamId),
    loadUserVideoPermissions(supabase, input.userId),
  ])

  const fullName = (profileRes.data as { full_name?: string | null } | null)?.full_name?.trim() ?? null
  const displayName = fullName && fullName.length > 0 ? fullName : null

  const tr = teamRes.data as { id?: string; name?: string | null; logo_url?: string | null } | null
  if (!tr?.id) {
    throw new Error("TEAM_NOT_FOUND")
  }

  const roleUpper = input.liteRole.toUpperCase().replace(/ /g, "_")

  const videoClips = await buildVideoClipsSection(supabase, {
    userId: input.userId,
    teamId: input.teamId,
    videoFlags,
    videoPerms,
  })

  return {
    user: {
      id: input.userId,
      email: input.email,
      role: roleUpper,
      teamId: input.liteTeamId,
      displayName,
      isPlatformOwner: input.isPlatformOwner,
    },
    team: {
      id: tr.id,
      name: tr.name ?? "",
      logoUrl: tr.logo_url ?? null,
    },
    flags: flagsFromMembership(input.membership),
    unreadNotifications: unread,
    engagement: { counts: null },
    videoClips,
    generatedAt: new Date().toISOString(),
  }
}

function flagsFromMembership(m: UserMembership): AppBootstrapTeamFlags {
  const delegated = Boolean(m.delegatedTeamManage)
  return {
    canEditRoster: canEditRoster(m.role),
    canManageTeam: canManageTeam(m.role),
    canManageTeamEffective: canManageTeam(m.role) || delegated,
    canPostAnnouncements: canPostAnnouncements(m.role),
    canViewPayments: canViewPayments(m.role),
  }
}

export async function buildAppBootstrapPayload(input: {
  userId: string
  email: string
  teamId: string
  liteTeamId: string | undefined
  liteRole: string
  isPlatformOwner: boolean
  membership: UserMembership
}): Promise<AppBootstrapPayload> {
  const supabase = getSupabaseServer()
  const roleUpper = input.liteRole.toUpperCase().replace(/ /g, "_")
  const loadHints = ENGAGEMENT_ROLES.has(roleUpper)

  const [profileRes, teamRes, unread, hintCounts, videoFlags, videoPerms] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", input.userId).maybeSingle(),
    supabase.from("teams").select("id, name, logo_url").eq("id", input.teamId).maybeSingle(),
    getUnreadNotificationCount(input.userId, input.teamId),
    loadHints ? loadEngagementHintCounts(input.teamId) : Promise.resolve(null),
    loadTeamOrgVideoFlags(supabase, input.teamId),
    loadUserVideoPermissions(supabase, input.userId),
  ])

  const fullName = (profileRes.data as { full_name?: string | null } | null)?.full_name?.trim() ?? null
  const displayName = fullName && fullName.length > 0 ? fullName : null

  const tr = teamRes.data as { id?: string; name?: string | null; logo_url?: string | null } | null
  if (!tr?.id) {
    throw new Error("TEAM_NOT_FOUND")
  }

  const videoClips = await buildVideoClipsSection(supabase, {
    userId: input.userId,
    teamId: input.teamId,
    videoFlags,
    videoPerms,
  })

  return {
    user: {
      id: input.userId,
      email: input.email,
      role: roleUpper,
      teamId: input.liteTeamId,
      displayName,
      isPlatformOwner: input.isPlatformOwner,
    },
    team: {
      id: tr.id,
      name: tr.name ?? "",
      logoUrl: tr.logo_url ?? null,
    },
    flags: flagsFromMembership(input.membership),
    unreadNotifications: unread,
    engagement: { counts: hintCounts },
    videoClips,
    generatedAt: new Date().toISOString(),
  }
}
