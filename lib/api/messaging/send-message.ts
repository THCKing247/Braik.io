import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

export type PostMessagesSendBody = {
  threadId: string
  body: string
  attachments: unknown[]
}

/** POST /api/messages/send — preserves legacy error string shaping (details/code concat). */
export async function postMessagesSend(payload: PostMessagesSendBody): Promise<unknown> {
  const response = await fetchWithTimeout("/api/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  })

  const responseData = (await response.json().catch(() => ({}))) as {
    error?: string
    details?: string
    code?: string
    [key: string]: unknown
  }

  if (!response.ok) {
    const errorMessage = responseData.error || responseData.details || "Failed to send message"
    const fullError = responseData.details || responseData.code
      ? `${errorMessage}${responseData.details ? ` (${responseData.details})` : ""}${responseData.code ? ` [${responseData.code}]` : ""}`
      : errorMessage
    throw new Error(fullError)
  }

  return responseData
}

export type PostMessagesThreadsCreateBody = {
  teamId: string
  subject: string
  participantUserIds: string[]
}

/** POST /api/messages/threads/create */
export async function postMessagesThreadsCreate(body: PostMessagesThreadsCreateBody): Promise<Record<string, unknown>> {
  const response = await fetchWithTimeout("/api/messages/threads/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(error.error || "Failed to create thread")
  }

  return (await response.json()) as Record<string, unknown>
}
