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
import type { AppBootstrapPayload, AppBootstrapTeamFlags } from "@/lib/app/app-bootstrap-types"

const ENGAGEMENT_ROLES = new Set(["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"])

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

  const [profileRes, teamRes, unread] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", input.userId).maybeSingle(),
    supabase.from("teams").select("id, name, logo_url").eq("id", input.teamId).maybeSingle(),
    getUnreadNotificationCount(input.userId, input.teamId),
  ])

  const fullName = (profileRes.data as { full_name?: string | null } | null)?.full_name?.trim() ?? null
  const displayName = fullName && fullName.length > 0 ? fullName : null

  const tr = teamRes.data as { id?: string; name?: string | null; logo_url?: string | null } | null
  if (!tr?.id) {
    throw new Error("TEAM_NOT_FOUND")
  }

  const roleUpper = input.liteRole.toUpperCase().replace(/ /g, "_")

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

  const [profileRes, teamRes, unread, hintCounts] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", input.userId).maybeSingle(),
    supabase.from("teams").select("id, name, logo_url").eq("id", input.teamId).maybeSingle(),
    getUnreadNotificationCount(input.userId, input.teamId),
    loadHints ? loadEngagementHintCounts(input.teamId) : Promise.resolve(null),
  ])

  const fullName = (profileRes.data as { full_name?: string | null } | null)?.full_name?.trim() ?? null
  const displayName = fullName && fullName.length > 0 ? fullName : null

  const tr = teamRes.data as { id?: string; name?: string | null; logo_url?: string | null } | null
  if (!tr?.id) {
    throw new Error("TEAM_NOT_FOUND")
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
    unreadNotifications: unread,
    engagement: { counts: hintCounts },
    generatedAt: new Date().toISOString(),
  }
}
