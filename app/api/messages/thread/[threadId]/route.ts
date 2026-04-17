/**
 * Alias: GET /api/messages/thread/[threadId] — same handler as /api/messages/threads/[threadId]
 * (paginated message history; use for clients that prefer singular "thread").
 */
export { GET } from "../../threads/[threadId]/route"
