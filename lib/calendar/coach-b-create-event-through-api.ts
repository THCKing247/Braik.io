import type { CreateEventToolArgs } from "@/lib/braik-ai/coach-b-tools-schemas"

function resolveRequestOrigin(req: Request): string {
  try {
    const u = new URL(req.url)
    if (u.origin && u.origin !== "null") {
      return u.origin
    }
  } catch {
    /* ignore */
  }
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host")
  const proto = req.headers.get("x-forwarded-proto") || "https"
  if (host) {
    return `${proto}://${host}`
  }
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || ""
  return base || "http://localhost:3000"
}

/**
 * Maps Coach B tool args to POST /api/teams/[teamId]/calendar/events body shape.
 * Keeps AI confirmations aligned with the manual calendar UI.
 */
export function mapCreateEventToolToCalendarApiBody(a: CreateEventToolArgs): Record<string, unknown> {
  const audienceMap: Record<string, string> = {
    team: "players",
    parents: "parents",
    staff: "staff",
    all: "all",
  }
  const typeStr =
    a.event_type === "practice"
      ? "practice"
      : a.event_type === "game"
        ? "game"
        : a.event_type === "meeting"
          ? "meeting"
          : "other"

  const body: Record<string, unknown> = {
    title: a.title,
    start: a.start_iso,
    end: a.end_iso,
    type: typeStr,
    audience: audienceMap[a.audience ?? "team"] ?? "players",
  }
  if (a.location?.trim()) {
    body.location = a.location.trim()
  }
  return body
}

function extractCalendarApiError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>
    if (typeof p.message === "string") return p.message
    const err = p.error
    if (err && typeof err === "object" && typeof (err as { message?: string }).message === "string") {
      return (err as { message: string }).message
    }
    if (typeof err === "string") return err
  }
  return `Calendar request failed (${status})`
}

/**
 * Creates a team calendar event using the same HTTP handler as the calendar UI,
 * forwarding the browser cookie so session + RBAC match the user’s request.
 */
export async function createTeamCalendarEventThroughApi(
  teamId: string,
  args: CreateEventToolArgs,
  incomingRequest: Request
): Promise<{ ok: true; event: { id: string } } | { ok: false; message: string }> {
  const origin = resolveRequestOrigin(incomingRequest)
  const url = `${origin}/api/teams/${encodeURIComponent(teamId)}/calendar/events`
  const body = mapCreateEventToolToCalendarApiBody(args)

  console.log("[Coach B] create_event → calendar API", {
    teamId,
    title: args.title,
    event_type: args.event_type,
    start_iso: args.start_iso,
    end_iso: args.end_iso,
    audience: args.audience ?? "team",
  })

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: incomingRequest.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(body),
  })

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    const message = extractCalendarApiError(payload, res.status)
    console.error("[Coach B] calendar API rejected create_event", { teamId, status: res.status, message })
    return { ok: false, message }
  }

  const event = payload as { id?: string } | null
  if (!event?.id || typeof event.id !== "string") {
    console.error("[Coach B] calendar API returned no event id", { teamId, payload })
    return { ok: false, message: "Event response was invalid. Please try from the calendar." }
  }

  console.log("[Coach B] calendar event persisted", { teamId, eventId: event.id })
  return { ok: true, event: { id: event.id } }
}
