/**
 * Messaging Permissions Utility
 * Defines who can message whom and create what types of threads
 */

export type UserRole = "HEAD_COACH" | "ASSISTANT_COACH" | "PLAYER" | "PARENT"
export type UserType = "coach" | "player" | "parent"

interface MessagingPermissions {
  canMessageIndividual: (targetRole: UserRole, targetType: UserType) => boolean
  canCreateOneOnOne: (targetRole: UserRole, targetType: UserType) => boolean
  canCreateGroupChat: () => boolean
  canCreateParentInclusiveThread: () => boolean
  canCreateParentOnlyThread: () => boolean
  canMessageJVUsers: () => boolean
  canMessageVarsityUsers: () => boolean
  canCreateThread: () => boolean // Only coaches can create threads per spec
  canReplyInThread: () => boolean // All participants can reply
}

/**
 * Get messaging permissions for a user role
 */
export function getMessagingPermissions(
  userRole: UserRole,
  isJVHeadCoach: boolean = false
): MessagingPermissions {
  switch (userRole) {
    case "HEAD_COACH":
      return {
        canMessageIndividual: () => true, // Can message anyone
        canCreateOneOnOne: () => true, // Can create 1-on-1 with anyone
        canCreateGroupChat: () => true, // Can create any group chat
        canCreateParentInclusiveThread: () => true, // Can include parents
        canCreateParentOnlyThread: () => true, // Can create parent-only threads
        canMessageJVUsers: () => true, // Can message JV users
        canMessageVarsityUsers: () => true, // Can message Varsity users
        canCreateThread: () => true, // Coaches can create threads
        canReplyInThread: () => true, // Can reply in threads
      }

    case "ASSISTANT_COACH":
      return {
        canMessageIndividual: (targetRole, targetType) => {
          // Can message coaches and players
          return targetType === "coach" || targetType === "player"
        },
        canCreateOneOnOne: (targetRole, targetType) => {
          // Can create 1-on-1 with coaches and players
          return targetType === "coach" || targetType === "player"
        },
        canCreateGroupChat: () => true, // Can participate in group chats
        canCreateParentInclusiveThread: () => true, // Can participate in parent-inclusive chats
        canCreateParentOnlyThread: () => false, // Cannot start parent-only threads
        canMessageJVUsers: () => true,
        canMessageVarsityUsers: () => true,
        canCreateThread: () => true, // Coaches can create threads
        canReplyInThread: () => true, // Can reply in threads
      }

    case "PLAYER":
      return {
        canMessageIndividual: (targetRole, targetType) => {
          // Players can message staff only.
          return targetType === "coach"
        },
        canCreateOneOnOne: (targetRole, targetType) => {
          // Cannot create threads - per spec, players can only reply
          return false
        },
        canCreateGroupChat: () => false, // Cannot create threads - per spec
        canCreateParentInclusiveThread: () => false, // Cannot create threads - per spec
        canCreateParentOnlyThread: () => false, // Cannot create threads - per spec
        canMessageJVUsers: () => false, // Same team only
        canMessageVarsityUsers: () => false, // Same team only
        canCreateThread: () => false, // Players cannot create threads - per spec
        canReplyInThread: () => true, // Players can reply in threads
      }

    case "PARENT":
      return {
        canMessageIndividual: (targetRole, targetType) => {
          // Parents can message staff only.
          return targetType === "coach"
        },
        canCreateOneOnOne: (targetRole, targetType) => {
          // Cannot create threads - per spec, parents can only reply
          return false
        },
        canCreateGroupChat: () => false, // Cannot create threads - per spec
        canCreateParentInclusiveThread: () => false, // Cannot create threads - per spec
        canCreateParentOnlyThread: () => false, // Cannot create threads - per spec
        canMessageJVUsers: () => false,
        canMessageVarsityUsers: () => false,
        canCreateThread: () => false, // Parents cannot create threads - per spec
        canReplyInThread: () => true, // Parents can reply in threads (in Parent + Player + Head Coach chat)
      }

    default:
      return {
        canMessageIndividual: () => false,
        canCreateOneOnOne: () => false,
        canCreateGroupChat: () => false,
        canCreateParentInclusiveThread: () => false,
        canCreateParentOnlyThread: () => false,
        canMessageJVUsers: () => false,
        canMessageVarsityUsers: () => false,
        canCreateThread: () => false,
        canReplyInThread: () => false,
      }
  }
}

/**
 * Check if a thread composition is valid based on permissions
 */
export function validateThreadComposition(
  creatorRole: UserRole,
  participantRoles: Array<{ role: UserRole; type: UserType }>
): { valid: boolean; reason?: string } {
  const permissions = getMessagingPermissions(creatorRole)

  // Check for parent + player without coach
  const hasParent = participantRoles.some((p) => p.type === "parent")
  const hasPlayer = participantRoles.some((p) => p.type === "player")
  const hasCoach = participantRoles.some((p) => p.type === "coach")

  // Global rule: No parent ↔ player 1-on-1 threads
  if (hasParent && hasPlayer && !hasCoach) {
    return {
      valid: false,
      reason: "Parent and player communication must include at least one coach",
    }
  }

  // Parents cannot create group chats
  if (creatorRole === "PARENT" && participantRoles.length > 1) {
    return {
      valid: false,
      reason: "Parents cannot create group chats",
    }
  }

  // Players cannot create parent-inclusive threads
  if (creatorRole === "PLAYER" && hasParent && !hasCoach) {
    return {
      valid: false,
      reason: "Players cannot create parent-inclusive threads without a coach",
    }
  }

  // Assistant coaches cannot create parent-only threads
  if (creatorRole === "ASSISTANT_COACH" && hasParent && !hasPlayer && !hasCoach) {
    return {
      valid: false,
      reason: "Assistant coaches cannot create parent-only threads",
    }
  }

  return { valid: true }
}

/**
 * Determine user type from role
 */
export function getUserType(role: UserRole): UserType {
  if (role === "HEAD_COACH" || role === "ASSISTANT_COACH") {
    return "coach"
  }
  if (role === "PLAYER") {
    return "player"
  }
  return "parent"
}

/**
 * Check if parent read-only visibility applies (HS only, not university)
 * This is used to determine if parents should have read-only access to player threads
 */
export function isHighSchoolTeam(organizationType: string | null | undefined): boolean {
  // Parent access applies to high school ("school") but not university ("college")
  return organizationType === "school"
}
