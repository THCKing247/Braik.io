import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies, type SessionUser } from "@/lib/auth/server-auth"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccessWithUser, MembershipLookupError } from "@/lib/auth/rbac"
import { shouldLogRoutePerf, routePerf, logRoutePerf, type RoutePerfSink } from "@/lib/debug/route-perf"
import { normalizePlayerImageUrl } from "@/lib/player-image-url"
import { createNotifications } from "@/lib/utils/notifications"
import { assertCanAddActivePlayers } from "@/lib/billing/roster-entitlement"
import { trackProductEventServer } from "@/lib/analytics/track-server"
import { BRAIK_EVENTS } from "@/lib/analytics/event-names"
import { revalidateTeamRosterDerivedCaches } from "@/lib/cache/lightweight-get-cache"
import { getTrustedAppOriginOrEmpty } from "@/lib/invites/resolve-invite-app-origin"
import { buildPlayerInviteSignupPath } from "@/lib/invites/build-join-link"

/** Player row shape from DB (GET select + optional new columns from migration). */
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

/**
 * GET /api/roster?teamId=xxx
 * Returns team roster (players) for RosterManagerEnhanced.
 * `lite=1`: minimal fields only (id, names, grade, jersey, position) — skips injuries, invites, user join; use for pickers (playbook, schedule stats, settings).
 * Lite + full use `getRequestAuth` (no portal path). POST still uses full session.
 */
export async function GET(request: Request) {
  const started = performance.now()
  const sink: RoutePerfSink | null = shouldLogRoutePerf() ? [] : null

  try {
    const sessionResult = await routePerf(sink, "auth", () => getRequestAuth())
    if (!sessionResult?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const sessionUser = sessionResult.user as SessionUser

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const lite = searchParams.get("lite") === "1"
    const supabase = getSupabaseServer()

    if (lite) {
      await routePerf(sink, "membership", () => requireTeamAccessWithUser(teamId, sessionUser))
      const { data: rows, error } = await routePerf(sink, "query_players_lite", async () =>
        await supabase
          .from("players")
          .select("id, first_name, last_name, grade, jersey_number, position_group")
          .eq("team_id", teamId)
          .order("last_name", { ascending: true })
          .order("first_name", { ascending: true })
      )
      if (error) {
        console.error("[GET /api/roster] lite", error.message, error)
        return NextResponse.json({ error: "Failed to load roster" }, { status: 500 })
      }
      const litePlayers = (rows ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        firstName: (p.first_name as string) ?? "",
        lastName: (p.last_name as string) ?? "",
        grade:
          p.grade == null || p.grade === ""
            ? null
            : typeof p.grade === "number"
              ? p.grade
              : Number(p.grade),
        jerseyNumber: (p.jersey_number as number | null) ?? null,
        positionGroup: (p.position_group as string | null) ?? null,
      }))
      if (sink) {
        sink.push({ label: "total", ms: Math.round(performance.now() - started) })
        logRoutePerf("GET /api/roster?lite=1", sink, { teamId })
      }
      const res = NextResponse.json(litePlayers)
      if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
      return res
    }

    await routePerf(sink, "membership", () => requireTeamAccessWithUser(teamId, sessionUser))

    type InjuryRow = {
      player_id: string
      injury_reason: string
      severity: string | null
      exempt_from_practice: boolean | null
      expected_return_date: string | null
    }

    const [playersResult, injuriesResult] = await routePerf(sink, "players_and_injuries", () =>
      Promise.all([
        supabase
          .from("players")
          .select(
            "id, first_name, last_name, grade, jersey_number, position_group, secondary_position, status, notes, image_url, user_id, email, player_phone, invite_code, invite_status, claimed_at, created_by, updated_at"
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
    )

    const { data: rows, error } = playersResult
    if (error) {
      console.error("[GET /api/roster]", error.message, error)
      return NextResponse.json(
        { error: "Failed to load roster" },
        { status: 500 }
      )
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
      /* optional columns / table — roster still loads */
    }

    const userIds = [...new Set(typedRows.map((r) => r.user_id).filter(Boolean))] as string[]

    const [usersResult, invitesResult] = await routePerf(sink, "users_and_invites", () =>
      Promise.all([
        userIds.length > 0
          ? supabase.from("users").select("id, email").in("id", userIds)
          : Promise.resolve({ data: [] as { id: string; email: string }[], error: null }),
        supabase
          .from("player_invites")
          .select("player_id, status, token, sent_email_at, sent_sms_at")
          .eq("team_id", teamId)
          .in("status", ["pending", "sent", "claimed"]),
      ])
    )

    const userMap = new Map((usersResult.data ?? []).map((u) => [u.id, u]))
    const inviteRows = invitesResult.data
    type InviteRow = { player_id: string; status: string; token: string; sent_email_at?: string | null; sent_sms_at?: string | null }
    const inviteByPlayer = new Map<string, InviteRow>()
    for (const row of (inviteRows ?? []) as InviteRow[]) {
      inviteByPlayer.set(row.player_id, row)
    }

    const origin = getTrustedAppOriginOrEmpty(request)

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
        hasInvite && invite?.token && origin
          ? `${origin.replace(/\/$/, "")}${buildPlayerInviteSignupPath(invite.token)}`
          : undefined
      return {
        id: p.id,
        firstName: p.first_name ?? "",
        lastName: p.last_name ?? "",
        grade: p.grade ?? null,
        jerseyNumber: p.jersey_number ?? null,
        positionGroup: p.position_group ?? null,
        secondaryPosition: (p as PlayerRow).secondary_position ?? null,
        status: p.status ?? "active",
        updatedAt: (p as PlayerRow).updated_at ?? null,
        notes: p.notes ?? null,
        imageUrl: normalizePlayerImageUrl(p.image_url) ?? null,
        email: p.email ?? null,
        playerPhone: (p as PlayerRow).player_phone ?? null,
        inviteCode: p.invite_code ?? null,
        inviteStatus,
        joinLink,
        claimedAt: p.claimed_at ?? null,
        healthStatus: ((p as any).health_status ?? "active") as "active" | "injured" | "unavailable",
        weight: (p as any).weight ?? null,
        height: (p as any).height ?? null,
        missingForms: Array.isArray((p as any).missing_forms) ? (p as any).missing_forms : [],
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

    if (sink) {
      sink.push({ label: "total", ms: Math.round(performance.now() - started) })
      logRoutePerf("GET /api/roster", sink, { teamId })
    }

    const res = NextResponse.json(players)
    if (sessionResult.refreshedSession) applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
    return res
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[GET /api/roster] membership lookup failed (DB/schema)", { error: err.message, cause: err.cause })
      return NextResponse.json({ error: "Failed to load roster" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json(
        {
          error: "You don't have access to this team's roster.",
          code: "TEAM_ACCESS_DENIED",
          hint: "If you recently joined this team, try refreshing the page or signing out and back in. If the problem persists, ask your coach to re-send the team invite.",
        },
        { status: 403 }
      )
    }
    console.error("[GET /api/roster]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/roster - Add player (coach-created profile; no auth user required).
 * Business rule: Coach creates a roster record first; later the player can sign up and link (claim) it.
 * If they do, that counts as a billable roster slot (see billing warning in UI).
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const teamId = body?.teamId
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const { requireTeamPermission, MembershipLookupError } = await import("@/lib/auth/rbac")
    await requireTeamPermission(teamId, "edit_roster")

    const firstName = String(body?.firstName ?? "").trim()
    const lastName = String(body?.lastName ?? "").trim()
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 })
    }

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() || null : null
    const jerseyNumber = body?.jerseyNumber != null ? Number(body.jerseyNumber) : null
    const positionGroup = typeof body?.positionGroup === "string" ? body.positionGroup.trim().toUpperCase() || null : null

    const supabase = getSupabaseServer()

    // Helper function to determine position side
    const getPositionSide = (pos: string | null): "offense" | "defense" | "special" | null => {
      if (!pos) return null
      const offensePositions = ["QB", "RB", "WR", "TE", "OL"]
      const defensePositions = ["DL", "LB", "DB"]
      const specialPositions = ["K", "P"]
      if (offensePositions.includes(pos)) return "offense"
      if (defensePositions.includes(pos)) return "defense"
      if (specialPositions.includes(pos)) return "special"
      return null
    }

    // Duplicate check: same team + first+last name + same jersey (or same email if provided)
    const { data: existingByName } = await supabase
      .from("players")
      .select("id, jersey_number, position_group")
      .eq("team_id", teamId)
      .ilike("first_name", firstName)
      .ilike("last_name", lastName)

    // Jersey number validation: allow duplicate if one is offense and one is defense
    let duplicateByJersey = false
    if (jerseyNumber != null && jerseyNumber >= 0 && jerseyNumber <= 99) {
      const newPlayerSide = getPositionSide(positionGroup)
      
      // Check for jersey conflicts
      const { data: existingByJersey } = await supabase
        .from("players")
        .select("id, first_name, last_name, position_group")
        .eq("team_id", teamId)
        .eq("jersey_number", jerseyNumber)

      if (existingByJersey && existingByJersey.length > 0) {
        // If new player has no position or special teams, allow duplicate
        if (!newPlayerSide || newPlayerSide === "special") {
          // Special teams can share numbers, but check if there's a conflict with same side
          const hasConflict = existingByJersey.some((p) => {
            const existingSide = getPositionSide(p.position_group)
            return existingSide === newPlayerSide
          })
          if (hasConflict && newPlayerSide) {
            duplicateByJersey = true
          }
        } else {
          // Check if any existing player with same jersey is on the same side
          const hasSameSideConflict = existingByJersey.some((p) => {
            const existingSide = getPositionSide(p.position_group)
            // Conflict if both are offense or both are defense
            return existingSide === newPlayerSide
          })
          if (hasSameSideConflict) {
            duplicateByJersey = true
          }
        }
      }
    } else if (jerseyNumber != null && (jerseyNumber < 0 || jerseyNumber > 99)) {
      return NextResponse.json(
        { error: "Jersey number must be between 0 and 99." },
        { status: 400 }
      )
    }

    // Same first+last name with no jersey given: treat as duplicate to avoid multiple "John Smith" placeholders
    const duplicateByNameOnly = (existingByName?.length ?? 0) > 0 && jerseyNumber == null
    let duplicateByEmail = false
    if (email) {
      const { data: byEmail } = await supabase
        .from("players")
        .select("id")
        .eq("team_id", teamId)
        .ilike("email", email)
        .maybeSingle()
      duplicateByEmail = !!byEmail
    }
    if (duplicateByJersey) {
      return NextResponse.json(
        { error: "Jersey number is already in use by a player on the same side (offense/defense). Two players with the same number cannot both be on the same side of the ball." },
        { status: 409 }
      )
    }
    if (duplicateByEmail || duplicateByNameOnly) {
      return NextResponse.json(
        { error: "A player with this name (or email) already exists on this roster." },
        { status: 409 }
      )
    }

    const weight = body?.weight != null ? Number(body.weight) : null
    const height = typeof body?.height === "string" ? body.height.trim() || null : null

    const capacity = await assertCanAddActivePlayers(supabase, teamId, 1)
    if (!capacity.ok) {
      trackProductEventServer({
        eventName: BRAIK_EVENTS.roster.limit_blocked,
        eventCategory: "billing",
        userId: session.user.id,
        teamId,
        role: session.user.role ?? null,
        metadata: {
          limit: capacity.limit ?? null,
          current: capacity.current ?? null,
        },
      })
      return NextResponse.json(
        { error: capacity.message, code: "ROSTER_LIMIT_REACHED", limit: capacity.limit, current: capacity.current },
        { status: 402 }
      )
    }

    const insertPayload: Record<string, unknown> = {
      team_id: teamId,
      first_name: firstName,
      last_name: lastName,
      grade: body?.grade ?? null,
      jersey_number: jerseyNumber ?? null,
      position_group: body?.positionGroup ?? null,
      notes: body?.notes ?? null,
      status: "active",
      weight: weight,
      height: height,
      invite_status: "not_invited",
      created_by: session.user.id,
      email: email ?? null,
      claim_status: "unclaimed",
      created_source: "coach",
      self_registered: false,
    }

    const { data: player, error } = await supabase
      .from("players")
      .insert(insertPayload)
      .select()
      .single()

    if (error || !player) {
      console.error("[POST /api/roster]", error?.message, error)
      return NextResponse.json(
        { error: error?.message ?? "Failed to add player" },
        { status: 500 }
      )
    }

    const p = player as PlayerRow & { email?: string | null; invite_code?: string | null; invite_status?: string; created_by?: string | null }
    try {
      await createNotifications({
        type: "roster_change",
        teamId,
        title: `Roster: ${p.first_name} ${p.last_name} added`,
        body: "New player added",
        linkType: "player",
        linkId: p.id,
        excludeUserIds: [session.user.id],
      })
    } catch {
      /* non-fatal */
    }

    trackProductEventServer({
      eventName: BRAIK_EVENTS.roster.player_created,
      userId: session.user.id,
      teamId,
      role: session.user.role ?? null,
      metadata: { player_id: p.id },
    })

    const out = {
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      grade: p.grade ?? null,
      jerseyNumber: p.jersey_number ?? null,
      positionGroup: p.position_group ?? null,
      status: p.status ?? "active",
      notes: p.notes ?? null,
      imageUrl: normalizePlayerImageUrl(p.image_url) ?? null,
      email: p.email ?? null,
      inviteCode: p.invite_code ?? null,
      inviteStatus: (p.invite_status ?? "not_invited") as "not_invited" | "invited" | "joined",
      claimedAt: (player as { claimed_at?: string | null }).claimed_at ?? null,
      weight: (p as any).weight ?? null,
      height: (p as any).height ?? null,
      user: null as { email: string } | null,
      guardianLinks: [] as Array<{ guardian: { user: { email: string } } }>,
    }
    revalidateTeamRosterDerivedCaches(teamId)
    return NextResponse.json(out)
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[POST /api/roster] membership lookup failed (DB/schema)", { error: err.message, cause: err.cause })
      return NextResponse.json({ error: "Failed to add player" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member") || message.includes("Insufficient")) {
      return NextResponse.json(
        {
          error: message.includes("Insufficient") ? "You don't have permission to edit the roster." : "You don't have access to this team's roster.",
          code: "TEAM_ACCESS_DENIED",
          hint: "If you recently joined this team, try refreshing the page or signing out and back in. If the problem persists, ask your coach to re-send the team invite.",
        },
        { status: 403 }
      )
    }
    console.error("[POST /api/roster]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
