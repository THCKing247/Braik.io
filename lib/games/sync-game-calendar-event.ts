import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import type { SupabaseClient } from "@supabase/supabase-js"

/** Default calendar block length for a game (kickoff → end); stored as timestamptz on `events.end`. */
export const GAME_CALENDAR_DURATION_MS = 2 * 60 * 60 * 1000

function gameCalendarTitle(opponent: string): string {
  const o = opponent.trim()
  return o ? `vs ${o}` : "vs Opponent"
}

async function ensurePublicUserRow(
  supabase: SupabaseClient,
  userId: string,
  email: string,
  name: string | null,
  role: string | null
): Promise<void> {
  const userTableRole = profileRoleToUserRole((role ?? "user").toLowerCase())
  const safeEmail = email?.trim() || `${userId}@users.braik.local`
  await supabase.from("users").upsert(
    {
      id: userId,
      email: safeEmail,
      name: name ?? null,
      role: userTableRole,
      status: "active",
    },
    { onConflict: "id" }
  )
}

/**
 * Creates or updates the `events` row for a game (`event_type` GAME, `linked_game_id` = game id).
 * Idempotent: repeated calls with the same game id update the same row (no duplicate events).
 */
export async function upsertCalendarEventForGame(
  supabase: SupabaseClient,
  args: {
    teamId: string
    gameId: string
    opponent: string
    gameDateIso: string
    location: string | null
    notes: string | null
    actorUserId: string
    actorEmail: string
    actorName: string | null
    actorRole: string | null
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const startMs = Date.parse(args.gameDateIso)
  if (!Number.isFinite(startMs)) {
    return { ok: false, message: "Invalid gameDate for calendar sync" }
  }
  const start = new Date(startMs)
  const end = new Date(startMs + GAME_CALENDAR_DURATION_MS)
  const title = gameCalendarTitle(args.opponent)
  const now = new Date().toISOString()

  try {
    await ensurePublicUserRow(
      supabase,
      args.actorUserId,
      args.actorEmail,
      args.actorName,
      args.actorRole
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "users upsert failed"
    return { ok: false, message: msg }
  }

  const { data: existing, error: selErr } = await supabase
    .from("events")
    .select("id")
    .eq("linked_game_id", args.gameId)
    .maybeSingle()

  if (selErr) {
    return { ok: false, message: selErr.message || "events lookup failed" }
  }

  const basePayload = {
    team_id: args.teamId,
    event_type: "GAME" as const,
    title,
    description: args.notes,
    start: start.toISOString(),
    end: end.toISOString(),
    location: args.location,
    visibility: "TEAM" as const,
    updated_at: now,
    linked_game_id: args.gameId,
  }

  if (existing?.id) {
    const { error: upErr } = await supabase.from("events").update(basePayload).eq("id", existing.id)
    if (upErr) {
      return { ok: false, message: upErr.message || "events update failed" }
    }
    return { ok: true }
  }

  const { error: insErr } = await supabase.from("events").insert({
    ...basePayload,
    created_by: args.actorUserId,
  })

  if (insErr) {
    // Race: another request inserted between select and insert — retry as update.
    if (insErr.code === "23505") {
      const { data: again } = await supabase.from("events").select("id").eq("linked_game_id", args.gameId).maybeSingle()
      if (again?.id) {
        const { error: upErr2 } = await supabase.from("events").update(basePayload).eq("id", again.id)
        if (upErr2) {
          return { ok: false, message: upErr2.message || "events update failed" }
        }
        return { ok: true }
      }
    }
    return { ok: false, message: insErr.message || "events insert failed" }
  }

  return { ok: true }
}

/**
 * Best-effort: games in the date window that never received a linked `events` row (legacy data or failed sync)
 * get a GAME event using an active team member as `created_by`.
 */
export async function repairOrphanGameCalendarEventsInRange(
  supabase: SupabaseClient,
  teamId: string,
  rangeStartIso: string,
  rangeEndIso: string
): Promise<void> {
  const { data: games, error: gErr } = await supabase
    .from("games")
    .select("id, opponent, game_date, location, notes")
    .eq("team_id", teamId)
    .gte("game_date", rangeStartIso)
    .lte("game_date", rangeEndIso)

  if (gErr || !games?.length) return

  const ids = games.map((g) => g.id)
  const { data: linkedRows } = await supabase.from("events").select("linked_game_id").eq("team_id", teamId).in("linked_game_id", ids)
  const have = new Set(
    (linkedRows ?? []).map((r) => r.linked_game_id as string).filter((x): x is string => typeof x === "string" && x.length > 0)
  )

  if (games.every((g) => have.has(g.id))) return

  const { data: member } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("active", true)
    .limit(1)
    .maybeSingle()

  const actorId = member?.user_id as string | undefined
  if (!actorId) return

  const { data: actorUser } = await supabase.from("users").select("email, name, role").eq("id", actorId).maybeSingle()
  const au = actorUser as { email?: string | null; name?: string | null; role?: string | null } | null

  for (const g of games) {
    if (have.has(g.id)) continue
    const row = g as { id: string; opponent?: string | null; game_date: string; location?: string | null; notes?: string | null }
    const res = await upsertCalendarEventForGame(supabase, {
      teamId,
      gameId: row.id,
      opponent: row.opponent ?? "",
      gameDateIso: row.game_date,
      location: row.location ?? null,
      notes: row.notes ?? null,
      actorUserId: actorId,
      actorEmail: au?.email ?? "",
      actorName: au?.name ?? null,
      actorRole: au?.role ?? null,
    })
    if (!res.ok && process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- dev-only orphan repair trace
      console.warn("[repairOrphanGameCalendarEventsInRange] skipped game", row.id, res.message)
    }
  }
}
