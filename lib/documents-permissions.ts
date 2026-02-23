/**
 * Documents & Resources Permissions Utilities
 * Implements hierarchical document/resource access control per BRAIK_MASTER_INTENT.md
 * 
 * Hierarchy:
 * - Head Coach → full access to all documents
 * - Coordinators (OC/DC/ST) → access to their unit's materials
 * - Position Coaches → access to position-specific materials
 * - Players → read-only access to assigned/viewable resources
 * - Parents → no access unless explicitly shared by Head Coach
 */

import { prisma } from "./prisma"
import { getCoordinatorType, getCoordinatorUnit, getPositionGroupsForUnit, type CoordinatorType, type Unit } from "./calendar-hierarchy"

export interface DocumentPermissions {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canLink: boolean // Can link documents to messages/announcements/events
  canViewAll: boolean // Can view all documents vs only scoped documents
  scopedUnit: Unit | null // Unit scope for coordinators
  scopedPositionGroups: string[] | null // Position groups scope for position coaches
  scopedPlayerIds: string[] | null // Player IDs scope (null = all players)
}

/**
 * Get document permissions for a user based on their role and membership
 */
export async function getDocumentPermissions(
  membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  teamId: string
): Promise<DocumentPermissions> {
  // Parents have no access unless explicitly shared (handled at document level)
  if (membership.role === "PARENT") {
    return {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canLink: false,
      canViewAll: false,
      scopedUnit: null,
      scopedPositionGroups: null,
      scopedPlayerIds: null,
    }
  }

  // Head Coach has full access
  if (membership.role === "HEAD_COACH") {
    return {
      canView: true,
      canCreate: true,
      canEdit: true,
      canDelete: true,
      canLink: true,
      canViewAll: true,
      scopedUnit: null,
      scopedPositionGroups: null,
      scopedPlayerIds: null,
    }
  }

  // Players have read-only access to documents visible to them
  if (membership.role === "PLAYER") {
    // Get the player record for this user
    const player = await prisma.player.findFirst({
      where: {
        teamId,
        userId: membership.userId,
        status: "active",
      },
      select: { id: true, positionGroup: true },
    })

    return {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canLink: false,
      canViewAll: false,
      scopedUnit: null,
      scopedPositionGroups: player?.positionGroup ? [player.positionGroup] : null,
      scopedPlayerIds: player ? [player.id] : [],
    }
  }

  // Assistant coaches (coordinators and position coaches)
  if (membership.role === "ASSISTANT_COACH") {
    const coordinatorType = getCoordinatorType(membership)
    const positionGroups = membership.positionGroups as string[] | null

    // Coordinators can view and manage documents for their unit
    if (coordinatorType) {
      const unit = getCoordinatorUnit(coordinatorType)
      const unitPositionGroups = unit ? getPositionGroupsForUnit(unit) : []

      // Get all players in this unit
      const unitPlayers = await prisma.player.findMany({
        where: {
          teamId,
          positionGroup: { in: unitPositionGroups },
          status: "active",
        },
        select: { id: true },
      })

      return {
        canView: true,
        canCreate: true, // Coordinators can create documents
        canEdit: true,
        canDelete: false, // Only Head Coach can delete
        canLink: true,
        canViewAll: true,
        scopedUnit: unit,
        scopedPositionGroups: unitPositionGroups,
        scopedPlayerIds: unitPlayers.map((p) => p.id),
      }
    }

    // Position coaches can view documents for their position group
    if (positionGroups && Array.isArray(positionGroups) && positionGroups.length > 0) {
      const positionGroupPlayers = await prisma.player.findMany({
        where: {
          teamId,
          positionGroup: { in: positionGroups },
          status: "active",
        },
        select: { id: true },
      })

      return {
        canView: true,
        canCreate: false, // Position coaches cannot create documents
        canEdit: false, // Position coaches cannot edit documents
        canDelete: false,
        canLink: false, // Position coaches cannot link documents
        canViewAll: false,
        scopedUnit: null,
        scopedPositionGroups: positionGroups,
        scopedPlayerIds: positionGroupPlayers.map((p) => p.id),
      }
    }

    // Generic assistant coach (no specific unit/position) - limited access
    return {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canLink: false,
      canViewAll: true,
      scopedUnit: null,
      scopedPositionGroups: null,
      scopedPlayerIds: null,
    }
  }

  // Default: no access
  return {
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canLink: false,
    canViewAll: false,
    scopedUnit: null,
    scopedPositionGroups: null,
    scopedPlayerIds: null,
  }
}

/**
 * Check if a user can view a specific document based on role and document scoping
 */
export async function canViewDocument(
  membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  teamId: string,
  document: {
    visibility: string
    scopedUnit: string | null
    scopedPositionGroups: any
    assignedPlayerIds: any
    createdBy: string
  }
): Promise<boolean> {
  const permissions = await getDocumentPermissions(membership, teamId)

  if (!permissions.canView) {
    return false
  }

  // Head Coach can view all documents
  if (membership.role === "HEAD_COACH") {
    return true
  }

  // Check visibility setting
  if (document.visibility === "staff" && membership.role === "PLAYER") {
    return false
  }
  if (document.visibility === "players" && membership.role === "PARENT") {
    return false
  }
  if (document.visibility === "parents" && membership.role !== "PARENT") {
    return false
  }

  // Parents: no access unless explicitly shared (visibility === "parents" or "all")
  // Only applies to high school teams (not university)
  if (membership.role === "PARENT") {
    // Check if this is a high school team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { organization: true },
    })

    if (!team || team.organization?.type !== "school") {
      // Parents don't have access at university level
      return false
    }

    // Parents can only see documents explicitly shared with them
    return document.visibility === "parents" || document.visibility === "all"
  }

  // Check unit scoping (for coordinators)
  if (document.scopedUnit) {
    if (permissions.scopedUnit && permissions.scopedUnit === document.scopedUnit) {
      return true
    }
    // If document is scoped to a unit but user is not that coordinator, deny
    if (permissions.scopedUnit && permissions.scopedUnit !== document.scopedUnit) {
      return false
    }
    // If user is not a coordinator but document is unit-scoped, deny
    if (!permissions.scopedUnit) {
      return false
    }
  }

  // Check position group scoping (for position coaches)
  if (document.scopedPositionGroups && Array.isArray(document.scopedPositionGroups)) {
    if (permissions.scopedPositionGroups) {
      // Check if there's any overlap
      const hasOverlap = document.scopedPositionGroups.some((pg: string) =>
        permissions.scopedPositionGroups?.includes(pg)
      )
      if (hasOverlap) {
        return true
      }
    }
    // If document is scoped to position groups but user doesn't have matching groups, deny
    if (!permissions.scopedPositionGroups || permissions.scopedPositionGroups.length === 0) {
      return false
    }
  }

  // Check player assignment scoping
  if (document.assignedPlayerIds && Array.isArray(document.assignedPlayerIds)) {
    if (membership.role === "PLAYER") {
      const player = await prisma.player.findFirst({
        where: {
          teamId,
          userId: membership.userId,
          status: "active",
        },
        select: { id: true },
      })
      if (player && document.assignedPlayerIds.includes(player.id)) {
        return true
      }
      return false
    }
    // For coaches, check if they have access to any of the assigned players
    if (permissions.scopedPlayerIds) {
      const hasAccess = document.assignedPlayerIds.some((pid: string) =>
        permissions.scopedPlayerIds?.includes(pid)
      )
      if (hasAccess) {
        return true
      }
    }
  }

  // If document has no scoping, check if user can view all documents
  if (!document.scopedUnit && !document.scopedPositionGroups && !document.assignedPlayerIds) {
    return permissions.canViewAll || membership.role === "PLAYER"
  }

  // Default: allow if user has view permission and document has no restrictive scoping
  return permissions.canView
}

/**
 * Check if a user can edit a specific document
 */
export async function canEditDocument(
  membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  teamId: string,
  document: {
    createdBy: string
    scopedUnit: string | null
  }
): Promise<boolean> {
  const permissions = await getDocumentPermissions(membership, teamId)

  if (!permissions.canEdit) {
    return false
  }

  // Head Coach can edit all documents
  if (membership.role === "HEAD_COACH") {
    return true
  }

  // Coordinators can edit documents in their unit
  if (permissions.scopedUnit && document.scopedUnit === permissions.scopedUnit) {
    return true
  }

  // Creator can edit their own documents (if they still have edit permission)
  if (document.createdBy === membership.userId && permissions.canEdit) {
    return true
  }

  return false
}

/**
 * Check if a user can delete a specific document
 */
export async function canDeleteDocument(
  membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  teamId: string,
  document: {
    createdBy: string
  }
): Promise<boolean> {
  const permissions = await getDocumentPermissions(membership, teamId)

  if (!permissions.canDelete) {
    return false
  }

  // Only Head Coach can delete documents
  return membership.role === "HEAD_COACH"
}
