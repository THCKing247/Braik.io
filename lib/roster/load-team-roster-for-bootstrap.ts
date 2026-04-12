import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { SessionUser } from "@/lib/auth/server-auth"
import { requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"
import { buildPlayerInviteSignupPath } from "@/lib/invites/build-join-link"

type PlayerRow = {
  id: string
  first_name: string
  last_name: string
  grade: number | null
  jersey_number: number | null
  position_group: string | null
  status: string
  notes: string | null
  image_url: string | null
  user_id: string | null
  email?: string | null
  player_phone?: string | null
  invite_code?: string | null
  invite_status?: string | null
  claimed_at?: string | null
  created_by?: string | null
  weight?: number | null
  height?: string | null
  secondary_position?: string | null
  updated_at?: string | null
}

type InjuryRow = {
  player_id: string
  injury_reason: string
  severity: string | null
  exempt_from_practice: boolean | null
  expected_return_date: string | null
}

/**
 * Same player array shape as GET /api/roster (non-lite), for dashboard bootstrap.
 */
export async function loadTeamRosterForBootstrap(
  teamId: string,
  sessionUser: SessionUser,
  appOrigin: string
): Promise<unknown[]> {
  await requireTeamAccessWithUser(teamId, sessionUser)
  const supabase = getSupabaseServer()

  const [playersResult, injuriesResult] = await Promise.all([
    supabase
      .from("players")
      .select(
        "id, first_name, last_name, grade, jersey_number, position_group, secondary_position, status, health_status, notes, image_url, user_id, email, player_phone, invite_code, invite_status, claimed_at, created_by, updated_at"
      )
      .eq("team_id", teamId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("player_injuries")
      .select("player_id, injury_reason, severity, exempt_from_practice, expected_return_date, status")
      .eq("team_id", teamId)
      .eq("status", "active"),
  ])

  const { data: rows, error } = playersResult
  if (error) {
    console.error("[loadTeamRosterForBootstrap] players", error.message)
    return []
  }

  const typedRows = (rows ?? []) as PlayerRow[]

  const injuryByPlayer = new Map<string, InjuryRow>()
  try {
    if (!injuriesResult.error && injuriesResult.data?.length) {
      for (const row of injuriesResult.data as InjuryRow[]) {
        if (!injuryByPlayer.has(row.player_id)) injuryByPlayer.set(row.player_id, row)
      }
    }
  } catch {
    /* optional */
  }

  const userIds = [...new Set(typedRows.map((r) => r.user_id).filter(Boolean))] as string[]

  const [usersResult, invitesResult] = await Promise.all([
    userIds.length > 0
      ? supabase.from("users").select("id, email").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; email: string }[], error: null }),
    supabase
      .from("player_invites")
      .select("player_id, status, token, sent_email_at, sent_sms_at")
      .eq("team_id", teamId)
      .in("status", ["pending", "sent", "claimed"]),
  ])

  const userMap = new Map((usersResult.data ?? []).map((u) => [u.id, u]))
  const inviteRows = invitesResult.data
  type InviteRow = {
    player_id: string
    status: string
    token: string
    sent_email_at?: string | null
    sent_sms_at?: string | null
  }
  const inviteByPlayer = new Map<string, InviteRow>()
  for (const row of (inviteRows ?? []) as InviteRow[]) {
    inviteByPlayer.set(row.player_id, row)
  }

  type InviteStatus = "not_invited" | "invite_created" | "email_sent" | "sms_sent" | "claimed" | "invite_sent"
  const players = typedRows.map((p) => {
    const invite = inviteByPlayer.get(p.id)
    const hasClaimedUser = !!p.user_id
    let inviteStatus: InviteStatus = "not_invited"
    if (hasClaimedUser) {
      inviteStatus = "claimed"
    } else if (invite) {
      if (invite.status === "claimed") inviteStatus = "claimed"
      else if (invite.sent_sms_at) inviteStatus = "sms_sent"
      else if (invite.sent_email_at) inviteStatus = "email_sent"
      else inviteStatus = "invite_created"
    }
    const hasInvite = invite && invite.status !== "claimed"
    const joinLink =
      hasInvite && invite?.token && appOrigin
        ? `${appOrigin.replace(/\/$/, "")}${buildPlayerInviteSignupPath(invite.token)}`
        : undefined
    return {
      id: p.id,
      firstName: p.first_name ?? "",
      lastName: p.last_name ?? "",
      grade: p.grade ?? null,
      jerseyNumber: p.jersey_number ?? null,
      positionGroup: p.position_group ?? null,
      secondaryPosition: p.secondary_position ?? null,
      status: p.status ?? "active",
      updatedAt: p.updated_at ?? null,
      notes: p.notes ?? null,
      imageUrl: normalizePlayerImageUrl(p.image_url) ?? null,
      email: p.email ?? null,
      playerPhone: p.player_phone ?? null,
      inviteCode: p.invite_code ?? null,
      inviteStatus,
      joinLink,
      claimedAt: p.claimed_at ?? null,
      healthStatus: ((p as PlayerRow & { health_status?: string }).health_status ?? "active") as
        | "active"
        | "injured"
        | "unavailable",
      weight: p.weight ?? null,
      height: p.height ?? null,
      missingForms: Array.isArray((p as PlayerRow & { missing_forms?: unknown }).missing_forms)
        ? ((p as PlayerRow & { missing_forms: unknown[] }).missing_forms as unknown[])
        : [],
      user: p.user_id ? (userMap.get(p.user_id) ? { email: userMap.get(p.user_id)!.email } : null) : null,
      guardianLinks: [] as Array<{ guardian: { user: { email: string } } }>,
      activeInjury: (() => {
        const inj = injuryByPlayer.get(p.id)
        if (!inj) return null
        return {
          reason: inj.injury_reason,
          severity: inj.severity,
          exemptFromPractice: inj.exempt_from_practice === true,
          expectedReturnDate: inj.expected_return_date,
        }
      })(),
    }
  })

  return players
}
