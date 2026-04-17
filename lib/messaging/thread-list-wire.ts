/**
 * Wire format for GET /api/messages/threads — minimal fields for sidebar list (fast JSON + small payload).
 * Map to UI `Thread` via `wireThreadListItemToThread` for MessagingManager.
 */

type ParticipantKindWire = "player" | "coach" | "parent" | "staff"

/** Participant row as returned on the wire (no full profile joins). */
export type WireThreadParticipant = {
  userId: string
  displayName: string
  participantKind: ParticipantKindWire
  email: string
}

export type WireLastMessage = {
  id: string
  body: string
  createdAt: string
  senderId: string
  senderDisplayName: string | null
}

export type MessageThreadWireItem = {
  threadId: string
  subject: string | null
  threadType: string
  updatedAt: string
  lastMessage: WireLastMessage | null
  participants: WireThreadParticipant[]
  unreadCount: number
  totalMessageCount: number
}

/** Legacy formatted thread from `loadMessageThreadsInboxPayload` (internal shape). */
type LegacyFormattedThread = {
  id: string
  subject: string | null
  threadType: string
  createdAt: string
  updatedAt: string
  creator: { id: string; name: string | null; email: string }
  participants: Array<{
    id: string
    userId: string
    readOnly: boolean
    participantKind: ParticipantKindWire
    user: { id: string; name: string | null; email: string; displayName: string }
  }>
  messages: Array<{
    id: string
    body: string
    attachments: unknown[]
    createdAt: string
    creator: { id: string; name: string | null; email: string }
  }>
  unreadCount?: number
  _count: { messages: number }
  isReadOnly?: boolean
  canReply?: boolean
}

function toIso(d: string | Date): string {
  if (typeof d === "string") return d
  return d.toISOString()
}

export function mapLegacyFormattedThreadsToWire(threads: unknown[]): MessageThreadWireItem[] {
  return (threads as LegacyFormattedThread[]).map((t) => {
    const lm = t.messages[0]
    return {
      threadId: t.id,
      subject: t.subject,
      threadType: t.threadType,
      updatedAt: toIso(t.updatedAt),
      lastMessage: lm
        ? {
            id: lm.id,
            body: lm.body,
            createdAt: typeof lm.createdAt === "string" ? lm.createdAt : toIso(lm.createdAt as Date),
            senderId: lm.creator.id,
            senderDisplayName: (lm.creator.name || lm.creator.email || "").trim() || null,
          }
        : null,
      participants: t.participants.map((p) => ({
        userId: p.userId,
        displayName: (p.user.displayName || p.user.name || p.user.email || "Member").trim(),
        participantKind: p.participantKind,
        email: p.user.email ?? "",
      })),
      unreadCount: t.unreadCount ?? 0,
      totalMessageCount: t._count?.messages ?? 0,
    }
  })
}

/** Build MessagingManager `Thread` from wire item (full detail loads on thread select). */
export function wireThreadListItemToThread(w: MessageThreadWireItem) {
  const participants = w.participants.map((p) => ({
    id: `${w.threadId}-${p.userId}`,
    userId: p.userId,
    readOnly: false,
    participantKind: p.participantKind,
    user: {
      id: p.userId,
      name: p.displayName,
      email: p.email,
      displayName: p.displayName,
    },
  }))

  const messages = w.lastMessage
    ? [
        {
          id: w.lastMessage.id,
          body: w.lastMessage.body,
          attachments: [],
          createdAt: new Date(w.lastMessage.createdAt),
          creator: {
            id: w.lastMessage.senderId,
            name: w.lastMessage.senderDisplayName,
            email: "",
          },
        },
      ]
    : []

  return {
    id: w.threadId,
    subject: w.subject,
    threadType: w.threadType,
    createdAt: new Date(w.updatedAt),
    updatedAt: new Date(w.updatedAt),
    creator: { id: w.participants[0]?.userId ?? w.threadId, name: null, email: "" },
    participants,
    messages,
    unreadCount: w.unreadCount,
    _count: { messages: w.totalMessageCount },
    isReadOnly: false,
    canReply: true,
  }
}
