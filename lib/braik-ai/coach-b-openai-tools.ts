import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions"
import { getOpenAIClient } from "@/lib/braik-ai/openai-client"

export const OPENAI_TOOLS_MODEL = process.env.OPENAI_TOOLS_MODEL || "gpt-4o"

export const COACH_B_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_event",
      description:
        "PRIMARY for scheduling: practice, workout, meeting, game, or anything 'on the calendar' with a time and optional location. Use ISO 8601 for start_iso and end_iso (same day if only time given). Set event_type to practice when they say practice. Include location when they name a field or place. Do NOT use send_notification or send_team_message to substitute for this—create the calendar row first.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          start_iso: { type: "string", description: "Start time ISO 8601" },
          end_iso: { type: "string", description: "End time ISO 8601" },
          event_type: { type: "string", enum: ["practice", "game", "meeting", "other"] },
          location: { type: "string" },
          audience: { type: "string", enum: ["team", "parents", "staff", "all"] },
        },
        required: ["title", "start_iso", "end_iso", "event_type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_player_depth_chart",
      description:
        "Move a player to a depth chart slot (unit, position, string). Identify player by jersey_number or player_id from Braik context.",
      parameters: {
        type: "object",
        properties: {
          jersey_number: { type: "integer" },
          player_id: { type: "string" },
          unit: { type: "string" },
          position: { type: "string" },
          string: { type: "integer", minimum: 1 },
        },
        required: ["unit", "position", "string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_team_message",
      description:
        "Draft message text only—does not send. Use when the coach wants wording for an announcement or message.",
      parameters: {
        type: "object",
        properties: {
          body: { type: "string" },
          audience_hint: { type: "string" },
        },
        required: ["body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_team_message",
      description:
        "Post an announcement-style message to team/parents/staff (requires confirmation). NOT a substitute for scheduling a practice with a time—use create_event for calendar items first.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          audience: { type: "string", enum: ["team", "parents", "staff", "all"] },
        },
        required: ["title", "body", "audience"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_notification",
      description:
        "Broadcast announcement / notify many people (requires confirmation). NOT for putting a dated practice or event on the calendar—use create_event first for that.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          audience: { type: "string", enum: ["all", "parents", "players", "staff"] },
          send_push: { type: "boolean" },
        },
        required: ["title", "body", "audience"],
      },
    },
  },
]

export function buildCoachBToolMessages(
  instructions: string,
  input: string | Array<{ role: "user" | "assistant" | "system" | "developer"; content: string }>
): ChatCompletionMessageParam[] {
  if (typeof input === "string") {
    return [
      { role: "system", content: instructions },
      { role: "user", content: input },
    ]
  }
  const dialogue = input
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
  return [{ role: "system", content: instructions }, ...dialogue]
}

export type CoachBToolCompletionOptions = {
  /** When set, the API must return a call to this tool (e.g. create_event for scheduling). */
  forceToolName?: "create_event"
}

export async function runCoachBToolCompletion(
  messages: ChatCompletionMessageParam[],
  options?: CoachBToolCompletionOptions
): Promise<{
  message: import("openai/resources/chat/completions").ChatCompletionMessage
}> {
  const client = getOpenAIClient()
  if (!client) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  const tool_choice =
    options?.forceToolName === "create_event"
      ? ({ type: "function" as const, function: { name: "create_event" } })
      : ("auto" as const)

  console.log("[OpenAI] Using tools model:", OPENAI_TOOLS_MODEL, {
    tool_choice: options?.forceToolName ? `force:${options.forceToolName}` : "auto",
  })
  const completion = await client.chat.completions.create({
    model: OPENAI_TOOLS_MODEL,
    messages,
    tools: COACH_B_TOOLS,
    tool_choice,
    temperature: 0.2,
  })
  const choice = completion.choices[0]
  if (!choice?.message) {
    throw new Error("No completion message from OpenAI")
  }
  return { message: choice.message }
}
