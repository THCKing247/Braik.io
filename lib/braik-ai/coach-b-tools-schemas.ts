import { z } from "zod"

export const createEventToolSchema = z.object({
  title: z.string().min(1).max(500),
  start_iso: z.string().min(1),
  end_iso: z.string().min(1),
  event_type: z.enum(["practice", "game", "meeting", "other"]),
  location: z.string().max(500).optional().nullable(),
  audience: z.enum(["team", "parents", "staff", "all"]).optional(),
})

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

export type CreateEventToolArgs = z.infer<typeof createEventToolSchema>
export type MovePlayerDepthChartArgs = z.infer<typeof movePlayerDepthChartSchema>
export type DraftTeamMessageArgs = z.infer<typeof draftTeamMessageSchema>
export type SendTeamMessageArgs = z.infer<typeof sendTeamMessageSchema>
export type SendNotificationArgs = z.infer<typeof sendNotificationSchema>
