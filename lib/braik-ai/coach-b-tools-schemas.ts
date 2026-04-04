import { z } from "zod"

/**
 * Model/tool output for create_event: raw scheduling fields only.
 * The app resolves relative phrases (tomorrow, Friday) and times using the user's local date + IANA zone.
 */
export const createEventSlotsSchema = z.object({
  title: z.string().min(1).max(500),
  event_type: z.enum(["practice", "game", "meeting", "other"]),
  location: z.string().max(500).optional().nullable(),
  audience: z.enum(["team", "parents", "staff", "all"]).optional(),
  /** e.g. "tomorrow", "today", "Friday" — resolved in code, not by the model as a final timestamp */
  relativeDateText: z.string().max(200).optional().nullable(),
  /** e.g. "April 5", "4/5/2026", "2026-04-05" — optional if relativeDateText is enough */
  explicitDateText: z.string().max(200).optional().nullable(),
  /** e.g. "6 pm", "18:00" */
  timeText: z.string().min(1).max(120),
  durationMinutes: z.number().int().min(15).max(24 * 60).optional().nullable(),
})

export type CreateEventSlots = z.infer<typeof createEventSlotsSchema>

/** After resolution / legacy stored payloads: concrete instants for DB + calendar API. */
export const createEventResolvedSchema = z.object({
  title: z.string().min(1).max(500),
  start_iso: z.string().min(1),
  end_iso: z.string().min(1),
  event_type: z.enum(["practice", "game", "meeting", "other"]),
  location: z.string().max(500).optional().nullable(),
  audience: z.enum(["team", "parents", "staff", "all"]).optional(),
})

/** @deprecated use createEventResolvedSchema — alias kept for calendar + executor imports */
export const createEventToolSchema = createEventResolvedSchema

export type CreateEventResolvedArgs = z.infer<typeof createEventResolvedSchema>
/** Resolved create_event args (ISO instants). Same as CreateEventResolvedArgs. */
export type CreateEventToolArgs = CreateEventResolvedArgs

export const movePlayerDepthChartSchema = z.object({
  jersey_number: z.number().int().positive().optional(),
  player_id: z.string().uuid().optional(),
  unit: z.string().min(1).max(32),
  position: z.string().min(1).max(32),
  string: z.number().int().min(1).max(10),
})

export const draftTeamMessageSchema = z.object({
  body: z.string().min(1).max(20000),
  audience_hint: z.string().max(200).optional(),
})

export const sendTeamMessageSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(20000),
  audience: z.enum(["team", "parents", "staff", "all"]),
})

export const sendNotificationSchema = z.object({
  title: z.string().min(1).max(500),
  body: z.string().min(1).max(20000),
  audience: z.enum(["all", "parents", "players", "staff"]),
  send_push: z.boolean().optional(),
})

export type MovePlayerDepthChartArgs = z.infer<typeof movePlayerDepthChartSchema>
export type DraftTeamMessageArgs = z.infer<typeof draftTeamMessageSchema>
export type SendTeamMessageArgs = z.infer<typeof sendTeamMessageSchema>
export type SendNotificationArgs = z.infer<typeof sendNotificationSchema>
