/**
 * Messaging permission helpers by role.
 */

const COACH_ROLES = ["HEAD_COACH", "ASSISTANT_COACH"]

export type MessagingPermissions = {
  canCreateThread: () => boolean
  canReplyToThread: () => boolean
  canViewThreads: () => boolean
}

export function getMessagingPermissions(role: string): MessagingPermissions {
  const isCoach = COACH_ROLES.includes(role)
  return {
    canCreateThread: () => isCoach,
    canReplyToThread: () => true,
    canViewThreads: () => true,
  }
}

export function getUserType(role: string): "coach" | "parent" | "player" {
  if (COACH_ROLES.includes(role)) return "coach"
  if (role === "PARENT") return "parent"
  return "player"
}
