"use client"

import { format } from "date-fns"
import type { Message, Thread, ThreadParticipant } from "@/components/portal/messaging/types"

export function displayNameForParticipantUser(u: ThreadParticipant["user"]) {
  return (u.displayName || u.name || u.email || "Member").trim()
}

export function initialsFromDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function getThreadDisplayName(thread: Thread, userId: string) {
  if (thread.threadType === "GENERAL") return "General Chat"
  if (thread.subject) return thread.subject
  const otherParticipants = thread.participants
    .filter((p) => p.user.id !== userId)
    .map((p) => displayNameForParticipantUser(p.user))
  return otherParticipants.join(", ") || "New Thread"
}

export function threadCategoryLabel(thread: Thread, userId: string) {
  const t = thread.threadType
  if (t === "GENERAL") return "Team"
  if (t === "GROUP" || t === "group") return "Group"
  const other = thread.participants.find((p) => p.user.id !== userId)
  if (other?.participantKind === "player") return "Player"
  if (other?.participantKind === "parent") return "Parent"
  if (other?.participantKind === "coach" || other?.participantKind === "staff") return "Staff"
  return "Chat"
}

export function primaryThreadPeer(thread: Thread, userId: string) {
  const others = thread.participants.filter((p) => p.user.id !== userId)
  if (others.length === 1) return others[0]
  return null
}

export function messageDayKey(input: Date | string): string {
  const d = new Date(input)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function messageDaySeparatorLabel(input: Date | string): string {
  return format(new Date(input), "EEEE, MMM d")
}

export function messageAttachmentIsImage(att: {
  fileName?: string
  mimeType?: string
  fileUrl?: string
}): boolean {
  const mime = String(att?.mimeType || "").toLowerCase()
  if (mime.startsWith("image/")) return true
  const fileName = String(att?.fileName || att?.fileUrl || "").toLowerCase()
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/.test(fileName)
}

export function threadInboxRowKey(thread: Thread): string {
  const newestMessageId = thread.messages[0]?.id ?? "none"
  const unread = thread.unreadCount ?? 0
  return `${thread.id}:${thread.updatedAt}:${newestMessageId}:${unread}`
}

export function isNearBottomEl(el: HTMLElement, thresholdPx = 56) {
  const { scrollTop, scrollHeight, clientHeight } = el
  return scrollHeight - scrollTop - clientHeight <= thresholdPx
}
