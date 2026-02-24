/**
 * Inventory Permissions Utilities
 * Implements hierarchical inventory management permissions per BRAIK_MASTER_INTENT.md Section 13
 * 
 * Hierarchy:
 * - Head Coach → full access to all inventory (can view all, create, edit, delete, assign)
 * - Coordinators (OC/DC/ST) → view and manage inventory for their unit only
 *   - Can create, edit, assign items
 *   - Can only view items assigned to their unit's players OR unassigned items
 *   - Can only assign items to players in their unit
 *   - Cannot delete items (Head Coach only)
 * - Position Coaches → view and assign inventory for their position group only
 *   - Can view items assigned to their position group's players OR unassigned items
 *   - Can assign/unassign items to players in their position group
 *   - Cannot create, edit, or delete items
 * - Players → view items assigned to them (read-only)
 *   - Can only see items specifically assigned to them
 *   - Cannot create, edit, delete, or assign
 * - Parents → no inventory access
 * 
 * Operational Scope:
 * - Inventory is operational tracking only (not financial/accounting)
 * - No purchasing, budgeting, or vendor integration features
 * - No public visibility
 */

import { prisma } from "./prisma"
import { getCoordinatorType, getCoordinatorUnit, getUnitForPositionGroup, type CoordinatorType, type Unit } from "./calendar-hierarchy"

export interface InventoryPermissions {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canAssign: boolean
  canViewAll: boolean // Can view all items vs only assigned items
  scopedPlayerIds: string[] | null // null = all players, array = specific players
}

/**
 * Get inventory permissions for a user based on their role and membership
 */
export async function getInventoryPermissions(
  membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  teamId: string
): Promise<InventoryPermissions> {
  // Parents have no inventory access
  if (membership.role === "PARENT") {
    return {
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canAssign: false,
      canViewAll: false,
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
      canAssign: true,
      canViewAll: true,
      scopedPlayerIds: null, // null = all players
    }
  }

  // Players can only view items assigned to them
  if (membership.role === "PLAYER") {
    // Get the player record for this user
    const player = await prisma.player.findFirst({
      where: {
        teamId,
        userId: membership.userId,
        status: "active",
      },
      select: { id: true },
    })

    return {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canAssign: false,
      canViewAll: false,
      scopedPlayerIds: player ? [player.id] : [],
    }
  }

  // Assistant coaches (coordinators and position coaches)
  if (membership.role === "ASSISTANT_COACH") {
    const coordinatorType = getCoordinatorType(membership)
    const positionGroups = membership.positionGroups as string[] | null

    // Coordinators can view and manage inventory for their unit
    if (coordinatorType) {
      const unit = getCoordinatorUnit(coordinatorType)
      const unitPositionGroups = await getPositionGroupsForUnit(teamId, unit)

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
        canCreate: true, // Coordinators can create items
        canEdit: true,
        canDelete: false, // Only Head Coach can delete
        canAssign: true,
        canViewAll: false, // Coordinators can only view their unit's inventory
        scopedPlayerIds: unitPlayers.map((p) => p.id),
      }
    }

    // Position coaches can view and assign inventory for their position group
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
        canCreate: false, // Position coaches cannot create items
        canEdit: false, // Position coaches cannot edit items
        canDelete: false,
        canAssign: true, // Position coaches can assign items to their players
        canViewAll: false, // Position coaches can only view their position group's inventory
        scopedPlayerIds: positionGroupPlayers.map((p) => p.id),
      }
    }

    // Generic assistant coach (no specific unit/position) - limited access
    return {
      canView: true,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canAssign: false,
      canViewAll: true,
      scopedPlayerIds: null,
    }
  }

  // Default: no access
  return {
    canView: false,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canAssign: false,
    canViewAll: false,
    scopedPlayerIds: null,
  }
}

/**
 * Get position groups for a unit (helper function)
 */
async function getPositionGroupsForUnit(teamId: string, unit: Unit): Promise<string[]> {
  if (!unit) return []

  const OFFENSIVE_POSITIONS = ["QB", "RB", "WR", "OL", "TE", "FB"]
  const DEFENSIVE_POSITIONS = ["DL", "LB", "DB", "DE", "DT", "CB", "S", "OLB", "ILB", "FS", "SS"]
  const SPECIAL_TEAMS_POSITIONS = ["K", "P", "LS", "KR", "PR"]

  switch (unit) {
    case "OFFENSE":
      return OFFENSIVE_POSITIONS
    case "DEFENSE":
      return DEFENSIVE_POSITIONS
    case "SPECIAL_TEAMS":
      return SPECIAL_TEAMS_POSITIONS
    default:
      return []
  }
}

/**
 * Check if a user can assign an item to a specific player
 */
export async function canAssignToPlayer(
  membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  teamId: string,
  playerId: string
): Promise<boolean> {
  const permissions = await getInventoryPermissions(membership, teamId)

  if (!permissions.canAssign) {
    return false
  }

  // Head Coach can assign to any player
  if (membership.role === "HEAD_COACH") {
    return true
  }

  // Check if the player is in the user's scope
  if (permissions.scopedPlayerIds === null) {
    // null means all players (shouldn't happen for non-head-coach, but handle it)
    return true
  }

  return permissions.scopedPlayerIds.includes(playerId)
}

/**
 * Check if a user can view a specific inventory item
 */
export async function canViewInventoryItem(
  membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  teamId: string,
  item: {
    assignedToPlayerId: string | null
  }
): Promise<boolean> {
  const permissions = await getInventoryPermissions(membership, teamId)

  if (!permissions.canView) {
    return false
  }

  // Head Coach can view all items
  if (permissions.canViewAll) {
    return true
  }

  // Players can only view items assigned to them
  if (membership.role === "PLAYER") {
    if (!item.assignedToPlayerId) {
      return false // Players can't see unassigned items
    }

    // Get the player record for this user
    const player = await prisma.player.findFirst({
      where: {
        teamId,
        userId: membership.userId,
        status: "active",
      },
      select: { id: true },
    })

    return player?.id === item.assignedToPlayerId
  }

  // Coordinators and position coaches can view:
  // - Items assigned to their scoped players
  // - Unassigned items (so they can assign them)
  if (membership.role === "ASSISTANT_COACH" && permissions.scopedPlayerIds) {
    // Unassigned items are visible to coordinators/position coaches
    if (!item.assignedToPlayerId) {
      return true
    }
    // Check if assigned to one of their scoped players
    return permissions.scopedPlayerIds.includes(item.assignedToPlayerId)
  }

  return false
}
