"use client"

import type { ParticipantKind, Thread } from "@/components/portal/messaging/types"
import { displayNameForParticipantUser, getThreadDisplayName, primaryThreadPeer, threadCategoryLabel } from "@/components/portal/messaging/messaging-display-utils"

export { displayNameForParticipantUser, getThreadDisplayName, primaryThreadPeer, threadCategoryLabel }

export function avatarClassForKind(kind?: ParticipantKind) {
  switch (kind) {
    case "player":
      return "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200/80"
    case "parent":
      return "bg-violet-100 text-violet-800 ring-1 ring-violet-200/80"
    case "coach":
    case "staff":
      return "bg-orange-100 text-orange-900 ring-1 ring-orange-200/80"
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80"
  }
}

export function threadRowUnread(thread: Thread): boolean {
  return (thread.unreadCount ?? 0) > 0
}
