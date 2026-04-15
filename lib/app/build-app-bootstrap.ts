import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { UserMembership } from "@/lib/auth/rbac"
import {
  canEditRoster,
  canManageTeam,
  canPostAnnouncements,
  canViewPayments,
} from "@/lib/auth/roles"
import { getUnreadNotificationCount } from "@/lib/utils/notifications"
import { loadEngagementHintCounts } from "@/lib/engagement/dashboard-hints-data"
import type {
  AppBootstrapPayload,
  AppBootstrapTeamFlags,
  AppBootstrapVideoClips,
} from "@/lib/app/app-bootstrap-types"
import {
  effectiveVideoClipsProductEnabled,
  loadTeamOrgVideoFlags,
  loadUserVideoPermissions,
  resolveVideoClipsNavVisible,
} from "@/lib/video/resolve-video-clips-access"
import { isCoachBPlusEntitled } from "@/lib/braik-ai/coach-b-plus-entitlement"

const ENGAGEMENT_ROLES = new Set(["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"])

/** Shell for first paint — intentionally lightweight. */
export async function buildAppBootstrapPayloadLite(input: {
  userId: string
  email: string
  teamId: string
  liteTeamId: string | undefined
  liteRole: string
  isPlatformOwner: boolean
  membership: UserMembership
  coachBPlusEntitled?: boolean
}): Promise<AppBootstrapPayload> {
  const supabase = getSupabaseServer()

  const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    const started = performance.now()
    try {
      return await fn()
    } finally {
      console.info(
        `[shell-lite] ${label} teamId=${input.teamId} userId=${input.userId} ms=${Math.round(
          performance.now() - started
        )}`
      )
    }
  }

  const [profileRes, teamRes] = await Promise.all([
    timed("profile", async () => {
      return await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", input.userId)
        .maybeSingle()
    }),
    timed("team", async () => {
      return await supabase
        .from("teams")
        .select("id, name, logo_url")
        .eq("id", input.teamId)
        .maybeSingle()
    }),
  ])

  const coachBPlus = input.coachBPlusEntitled ?? false

  const profileData = profileRes?.data as { full_name?: string | null } | null
  const fullName = profileData?.full_name?.trim() ?? null
  const displayName = fullName && fullName.length > 0 ? fullName : null

  const teamData = teamRes?.data as {
    id?: string
    name?: string | null
    logo_url?: string | null
  } | null

  if (!teamData?.id) {
    throw new Error("TEAM_NOT_FOUND")
  }

  const roleUpper = input.liteRole.toUpperCase().replace(/ /g, "_")

  const videoClips: AppBootstrapVideoClips = {
    productEnabled: false,
    navVisible: false,
    canViewVideo: false,
    canUploadVideo: false,
    canCreateClips: false,
    canShareClips: false,
    canDeleteVideo: false,
  }

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
      id: teamData.id,
      name: teamData.name ?? "",
      logoUrl: teamData.logo_url ?? null,
    },
    flags: flagsFromMembership(input.membership),
    coachBPlus,
    unreadNotifications: 0,
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
  coachBPlusEntitled?: boolean
}): Promise<AppBootstrapPayload> {
  const supabase = getSupabaseServer()
  const roleUpper = input.liteRole.toUpperCase().replace(/ /g, "_")
  const loadHints = ENGAGEMENT_ROLES.has(roleUpper)

  const coachBPlusPromise =
    input.coachBPlusEntitled !== undefined
      ? Promise.resolve(input.coachBPlusEntitled)
      : isCoachBPlusEntitled(supabase, input.teamId, input.userId, {
          isPlatformOwner: input.isPlatformOwner,
        })

  const [profileRes, teamRes, unread, hintCounts, videoFlags, videoPerms, coachBPlus] =
    await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", input.userId).maybeSingle(),
      supabase.from("teams").select("id, name, logo_url").eq("id", input.teamId).maybeSingle(),
      getUnreadNotificationCount(input.userId, input.teamId),
      loadHints ? loadEngagementHintCounts(input.teamId) : Promise.resolve(null),
      loadTeamOrgVideoFlags(supabase, input.teamId),
      loadUserVideoPermissions(supabase, input.userId),
      coachBPlusPromise,
    ])

  const fullName = (profileRes.data as { full_name?: string | null } | null)?.full_name?.trim() ?? null
  const displayName = fullName && fullName.length > 0 ? fullName : null

  const tr = teamRes.data as { id?: string; name?: string | null; logo_url?: string | null } | null
  if (!tr?.id) {
    throw new Error("TEAM_NOT_FOUND")
  }

  const productEnabled = effectiveVideoClipsProductEnabled({
    teamVideoClipsEnabled: videoFlags.teamVideoClipsEnabled,
    organizationVideoClipsEnabled: videoFlags.organizationVideoClipsEnabled,
    athleticDepartmentVideoClipsEnabled: videoFlags.athleticDepartmentVideoClipsEnabled,
  })

  const videoClips: AppBootstrapVideoClips = {
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
  }

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
    coachBPlus,
    unreadNotifications: unread,
    engagement: { counts: hintCounts },
    videoClips,
    generatedAt: new Date().toISOString(),
  }
}