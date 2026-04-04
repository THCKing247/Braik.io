import { addMinutes, format } from "date-fns"
import { toDate } from "date-fns-tz"
import {
  createEventResolvedSchema,
  createEventSlotsSchema,
  type CreateEventResolvedArgs,
  type CreateEventSlots,
} from "@/lib/braik-ai/coach-b-tools-schemas"

export type SchedulingResolutionContext = {
  /** IANA timezone from the client (e.g. America/New_York). */
  timeZone: string
  /** User's current local calendar date (YYYY-MM-DD). */
  localDate: string
}

/** When the client omits scheduling context, anchor to UTC calendar date (weak fallback). */
export function defaultSchedulingResolutionContext(): SchedulingResolutionContext {
  const localDate = new Date().toISOString().slice(0, 10)
  console.warn("[Coach B scheduling] missing client schedulingContext — using UTC date anchor", { localDate })
  return { timeZone: "UTC", localDate }
}

/** Parses `{ timeZone, localDate }` from the chat API body (client should send both). */
export function parseClientSchedulingContext(raw: unknown): SchedulingResolutionContext | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as { timeZone?: unknown; localDate?: unknown }
  const timeZone = typeof o.timeZone === "string" ? o.timeZone.trim() : ""
  const localDate = typeof o.localDate === "string" ? o.localDate.trim() : ""
  if (!timeZone || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null
  return { timeZone, localDate }
}

const DOW: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/** Calendar date arithmetic in the proleptic Gregorian calendar (timezone-agnostic Y-M-D). */
export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return ymd
  const utc = Date.UTC(y, m - 1, d + days)
  const dt = new Date(utc)
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

function getDayOfWeekYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number)
  if (!y || !m || !d) return 0
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function nextWeekdayOnOrAfter(anchorYmd: string, targetDow: number): string {
  const cur = getDayOfWeekYmd(anchorYmd)
  let add = (targetDow - cur + 7) % 7
  return addDaysToYmd(anchorYmd, add)
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

/**
 * Parse natural time strings: "6 pm", "6:30pm", "18:00", "7".
 * Returns 24h hour + minute or null.
 */
export function parseTimeText24h(timeText: string | null | undefined): { hour: number; minute: number } | null {
  if (!timeText?.trim()) return null
  const t = normalizeWhitespace(timeText).toLowerCase()
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/)
  if (m24) {
    const hour = parseInt(m24[1], 10)
    const minute = parseInt(m24[2], 10)
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute }
    return null
  }
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const minute = m[2] != null ? parseInt(m[2], 10) : 0
  const mer = (m[3] || "").replace(/\./g, "").toLowerCase()
  if (mer === "pm" || mer === "p") {
    if (hour < 12) hour += 12
  } else if (mer === "am" || mer === "a") {
    if (hour === 12) hour = 0
  } else if (!mer) {
    /* Bare hour like "6" with no a.m./p.m. — assume evening (1–11 → p.m.). */
    if (hour >= 1 && hour <= 11) hour += 12
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return { hour, minute }
}

function parseExplicitYmd(explicit: string, anchorYmd: string): string | null {
  const e = normalizeWhitespace(explicit)
  const iso = e.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const y = parseInt(iso[1], 10)
    const mo = parseInt(iso[2], 10)
    const d = parseInt(iso[3], 10)
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad2(mo)}-${pad2(d)}`
  }
  const us = e.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/)
  if (us) {
    let mo = parseInt(us[1], 10)
    let d = parseInt(us[2], 10)
    let y = us[3] ? parseInt(us[3], 10) : parseInt(anchorYmd.slice(0, 4), 10)
    if (us[3] && us[3].length === 2) y += y >= 70 ? 1900 : 2000
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 2000 && y <= 2100) return `${y}-${pad2(mo)}-${pad2(d)}`
  }
  const monthNames =
    /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?$/i
  const mm = e.match(monthNames)
  if (mm) {
    const monMap: Record<string, number> = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12,
    }
    const mi = monMap[mm[1].toLowerCase()]
    if (mi) {
      const d = parseInt(mm[2], 10)
      let y = mm[3] ? parseInt(mm[3], 10) : parseInt(anchorYmd.slice(0, 4), 10)
      if (d >= 1 && d <= 31) return `${y}-${pad2(mi)}-${pad2(d)}`
    }
  }
  return null
}

function resolveRelativeYmd(rel: string | null | undefined, anchorYmd: string): string | null {
  if (!rel?.trim()) return null
  const r = normalizeWhitespace(rel).toLowerCase()
  if (r === "today" || r === "tonight") return anchorYmd
  if (r === "tomorrow") return addDaysToYmd(anchorYmd, 1)
  const key = r.replace(/[^a-z]/g, "")
  if (key in DOW) {
    return nextWeekdayOnOrAfter(anchorYmd, DOW[key])
  }
  return null
}

function defaultDurationMinutes(eventType: CreateEventSlots["event_type"]): number {
  switch (eventType) {
    case "practice":
      return 120
    case "game":
      return 180
    case "meeting":
      return 60
    default:
      return 60
  }
}

export type ResolveSlotsResult =
  | { ok: true; resolved: CreateEventResolvedArgs }
  | { ok: false; error: string }

/** True if payload was stored with legacy start_iso / end_iso from older Coach B. */
export function isLegacyResolvedCreateEventPayload(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object") return false
  const p = payload as Record<string, unknown>
  return typeof p.start_iso === "string" && typeof p.end_iso === "string" && p.start_iso.length > 0 && p.end_iso.length > 0
}

/**
 * Turn model-extracted scheduling slots + user's local calendar anchor into concrete ISO instants.
 */
export function resolveCreateEventSlots(
  slots: CreateEventSlots,
  ctx: SchedulingResolutionContext
): { start: Date; end: Date; resolved: CreateEventResolvedArgs } | { error: string } {
  const timeZone = ctx.timeZone?.trim() || "UTC"
  const anchorYmd = /^\d{4}-\d{2}-\d{2}$/.test(ctx.localDate?.trim() ?? "")
    ? ctx.localDate.trim()
    : format(new Date(), "yyyy-MM-dd")

  const nowLog = new Date().toISOString()
  console.log("[Coach B scheduling] resolution anchor", {
    serverNowIso: nowLog,
    clientTimeZone: timeZone,
    clientLocalDate: anchorYmd,
    rawRelativeDateText: slots.relativeDateText ?? null,
    rawExplicitDateText: slots.explicitDateText ?? null,
    rawTimeText: slots.timeText ?? null,
  })

  let dateYmd: string | null = null
  const ex = slots.explicitDateText?.trim()
  if (ex) {
    dateYmd = parseExplicitYmd(ex, anchorYmd)
    if (!dateYmd) return { error: "I couldn’t understand that date. Say it with a clear day and time, or use the calendar." }
  } else {
    const rel = slots.relativeDateText?.trim()
    if (rel) {
      dateYmd = resolveRelativeYmd(rel, anchorYmd)
      if (!dateYmd) return { error: "I couldn’t pin down which day you mean. Try “tomorrow at 6” or a specific date." }
    } else {
      dateYmd = anchorYmd
    }
  }

  const timeParsed = parseTimeText24h(slots.timeText)
  if (!timeParsed) {
    return { error: "I need a time for the event (for example “6 pm” or “18:00”)." }
  }

  const { hour, minute } = timeParsed
  const wall = `${dateYmd}T${pad2(hour)}:${pad2(minute)}:00`

  let start: Date
  try {
    start = toDate(wall, { timeZone })
  } catch {
    return { error: "Could not resolve that date and time in your time zone. Check your device clock and try again." }
  }
  if (Number.isNaN(start.getTime())) {
    return { error: "Could not resolve that date and time." }
  }

  const dur =
    typeof slots.durationMinutes === "number" && slots.durationMinutes >= 15
      ? slots.durationMinutes
      : defaultDurationMinutes(slots.event_type)
  const end = addMinutes(start, dur)

  const resolved: CreateEventResolvedArgs = {
    title: slots.title.trim(),
    start_iso: start.toISOString(),
    end_iso: end.toISOString(),
    event_type: slots.event_type,
    location: slots.location?.trim() ? slots.location.trim() : null,
    audience: slots.audience,
  }

  console.log("[Coach B scheduling] resolved range", {
    clientTimeZone: timeZone,
    clientLocalDate: anchorYmd,
    rawRelativeDateText: slots.relativeDateText ?? null,
    rawExplicitDateText: slots.explicitDateText ?? null,
    rawTimeText: slots.timeText ?? null,
    wallLocal: wall,
    durationMinutes: dur,
    startIso: resolved.start_iso,
    endIso: resolved.end_iso,
  })

  return { start, end, resolved }
}

export function schedulingPayloadToResolvedArgs(
  payload: unknown,
  ctx: SchedulingResolutionContext
): ResolveSlotsResult {
  if (isLegacyResolvedCreateEventPayload(payload)) {
    const parsed = createEventResolvedSchema.safeParse(payload)
    if (!parsed.success) {
      return { ok: false, error: "Invalid stored calendar payload." }
    }
    return { ok: true, resolved: parsed.data }
  }

  const slotsParsed = createEventSlotsSchema.safeParse(payload)
  if (!slotsParsed.success) {
    return { ok: false, error: "Could not read the scheduling fields from that request." }
  }

  const out = resolveCreateEventSlots(slotsParsed.data, ctx)
  if ("error" in out) {
    return { ok: false, error: out.error }
  }
  return { ok: true, resolved: out.resolved }
}
