"use client"

export interface Message {
  id: string
  body: string
  attachments: any
  createdAt: Date
  creator: { id: string; name: string | null; email: string }
  isRemoved?: boolean
}

export type ParticipantKind = "player" | "coach" | "parent" | "staff"

export interface ThreadParticipant {
  id: string
  userId: string
  readOnly: boolean
  participantKind?: ParticipantKind
  user: { id: string; name: string | null; email: string; displayName?: string }
}

export interface Thread {
  id: string
  subject: string | null
  threadType: string
  createdAt: Date
  updatedAt: Date
  creator: { id: string; name: string | null; email: string }
  participants: ThreadParticipant[]
  messages: Message[]
  unreadCount?: number
  _count: { messages: number }
  isReadOnly?: boolean
  canReply?: boolean
  canModerate?: boolean
}

export interface Contact {
  id: string
  name: string
  email: string
  image: string | null
  role: string
  type: string
}
