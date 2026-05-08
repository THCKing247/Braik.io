import { ApiError } from "@/lib/api/core/api-error"
import { fetchJson } from "@/lib/api/core/fetch-json"

export type PostMessagesSendBody = {
  threadId: string
  body: string
  attachments: unknown[]
}

/** POST /api/messages/send — preserves legacy error string shaping (details/code concat). */
export async function postMessagesSend(payload: PostMessagesSendBody): Promise<unknown> {
  try {
    return await fetchJson("/api/messages/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    })
  } catch (error) {
    if (error instanceof ApiError) {
      const responseData = (error.body ?? {}) as {
        error?: string
        details?: string
        code?: string
      }
      const errorMessage = responseData.error || responseData.details || "Failed to send message"
      const fullError =
        responseData.details || responseData.code
          ? `${errorMessage}${responseData.details ? ` (${responseData.details})` : ""}${responseData.code ? ` [${responseData.code}]` : ""}`
          : errorMessage
      throw new Error(fullError)
    }
    throw error
  }
}

export type PostMessagesThreadsCreateBody = {
  teamId: string
  subject: string
  participantUserIds: string[]
}

/** POST /api/messages/threads/create */
export async function postMessagesThreadsCreate(body: PostMessagesThreadsCreateBody): Promise<Record<string, unknown>> {
  try {
    return await fetchJson<Record<string, unknown>>("/api/messages/threads/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    })
  } catch (error) {
    if (error instanceof ApiError) {
      const responseData = (error.body ?? {}) as { error?: string }
      throw new Error(responseData.error || "Failed to create thread")
    }
    throw error
  }
}
