/**
 * Calendar Hierarchy Utilities
 * Implements hierarchical event scoping and permissions per BRAIK_MASTER_INTENT.md
 */

import { prisma } from "./prisma"

// Position group to unit mapping
const OFFENSIVE_POSITIONS = ["QB", "RB", "WR", "OL", "TE", "FB"]
const DEFENSIVE_POSITIONS = ["DL", "LB", "DB", "DE", "DT", "CB", "S", "OLB", "ILB", "FS", "SS"]
const SPECIAL_TEAMS_POSITIONS = ["K", "P", "LS", "KR", "PR"]

export type CoordinatorType = "OC" | "DC" | "ST" | null
export type Unit = "OFFENSE" | "DEFENSE" | "SPECIAL_TEAMS" | null

/**
 * Map position group to unit
 */
export function getUnitForPositionGroup(positionGroup: string | null): Unit {
  if (!positionGroup) return null
  
  const upper = positionGroup.toUpperCase()
  if (OFFENSIVE_POSITIONS.includes(upper)) return "OFFENSE"
  if (DEFENSIVE_POSITIONS.includes(upper)) return "DEFENSE"
  if (SPECIAL_TEAMS_POSITIONS.includes(upper)) return "SPECIAL_TEAMS"
  return null
}

/**
 * Get all position groups for a unit
 */
export function getPositionGroupsForUnit(unit: Unit): string[] {
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
 * Check if a membership represents a coordinator
 * Coordinators are identified by having a coordinatorType in permissions JSON
 */
export function getCoordinatorType(membership: { permissions?: any }): CoordinatorType {
  if (!membership.permissions || typeof membership.permissions !== "object") {
    return null
  }
  
  const coordinatorType = membership.permissions.coordinatorType
  if (coordinatorType === "OC" || coordinatorType === "DC" || coordinatorType === "ST") {
    return coordinatorType
  }
  
  return null
}

/**
 * Get the unit that a coordinator manages
 */
export function getCoordinatorUnit(coordinatorType: CoordinatorType): Unit {
  switch (coordinatorType) {
    case "OC":
      return "OFFENSE"
    case "DC":
      return "DEFENSE"
    case "ST":
      return "SPECIAL_TEAMS"
    default:
      return null
  }
}

/**
 * Get player IDs that should see an event based on scoping
 */
export async function getScopedPlayerIds(
  teamId: string,
  scopedPlayerIds: string[] | null,
  scopedPositionGroups: string[] | null,
  scopedUnit: Unit | null
): Promise<string[]> {
  // If specific players are scoped, return those
  if (scopedPlayerIds && scopedPlayerIds.length > 0) {
    return scopedPlayerIds
  }
  
  // If position groups are scoped, get players in those groups
  if (scopedPositionGroups && scopedPositionGroups.length > 0) {
    const players = await prisma.player.findMany({
      where: {
        teamId,
        positionGroup: { in: scopedPositionGroups },
        status: "active",
      },
      select: { id: true },
    })
    return players.map((p) => p.id)
  }
  
  // If unit is scoped, get all players in that unit
  if (scopedUnit) {
    const positionGroups = getPositionGroupsForUnit(scopedUnit)
    const players = await prisma.player.findMany({
      where: {
        teamId,
        positionGroup: { in: positionGroups },
        status: "active",
      },
      select: { id: true },
    })
    return players.map((p) => p.id)
  }
  
  // No scoping = all players
  const allPlayers = await prisma.player.findMany({
    where: {
      teamId,
      status: "active",
    },
    select: { id: true },
  })
  return allPlayers.map((p) => p.id)
}

/**
 * Check if a user can edit an event based on hierarchical authority
 */
export async function canEditEvent(
  userId: string,
  event: {
    id: string
    teamId: string
    createdBy: string
    scopedPlayerIds?: string[] | null
    scopedPositionGroups?: string[] | null
    scopedUnit?: Unit | null
    coordinatorType?: CoordinatorType | null
  },
  membership: {
    role: string
    permissions?: any
    positionGroups?: string[] | null
  }
): Promise<boolean> {
  // Head Coach can edit all events
  if (membership.role === "HEAD_COACH") {
    return true
  }
  
  // Players and parents cannot edit
  if (membership.role === "PLAYER" || membership.role === "PARENT") {
    return false
  }
  
  // Assistant coaches can only edit events they created, or events in their scope
  if (membership.role === "ASSISTANT_COACH") {
    // If they created it, they can edit it
    if (event.createdBy === userId) {
      return true
    }
    
    // Check if they're a coordinator and the event is in their unit
    const coordinatorType = getCoordinatorType(membership)
    if (coordinatorType) {
      const coordinatorUnit = getCoordinatorUnit(coordinatorType)
      if (event.scopedUnit === coordinatorUnit) {
        return true
      }
    }
    
    // Check if they're a position coach and the event is for their position group
    const positionGroups = membership.positionGroups
    if (positionGroups && Array.isArray(positionGroups) && event.scopedPositionGroups) {
      const eventGroups = event.scopedPositionGroups as string[]
      if (Array.isArray(eventGroups)) {
        const hasOverlap = positionGroups.some((pg: string) =>
          eventGroups.includes(pg)
        )
        if (hasOverlap) {
          return true
        }
      }
    }
  }
  
  return false
}

/**
 * Check if a user can remove an event based on hierarchical authority
 */
export async function canRemoveEvent(
  userId: string,
  event: {
    id: string
    teamId: string
    createdBy: string
    scopedUnit?: Unit | null
    coordinatorType?: CoordinatorType | null
  },
  membership: {
    role: string
    permissions?: any
  }
): Promise<boolean> {
  // Head Coach can remove all events
  if (membership.role === "HEAD_COACH") {
    return true
  }
  
  // Players and parents cannot remove
  if (membership.role === "PLAYER" || membership.role === "PARENT") {
    return false
  }
  
  // Assistant coaches can only remove their own events
  if (membership.role === "ASSISTANT_COACH") {
    return event.createdBy === userId
  }
  
  return false
}

/**
 * Determine event scoping based on creator role
 */
export async function determineEventScoping(
  teamId: string,
  creatorRole: string,
  creatorPermissions: any,
  creatorPositionGroups: string[] | null
): Promise<{
  scopedPlayerIds: string[] | null
  scopedPositionGroups: string[] | null
  scopedUnit: Unit | null
  coordinatorType: CoordinatorType | null
}> {
  // Head Coach creates events for entire program (no scoping)
  if (creatorRole === "HEAD_COACH") {
    return {
      scopedPlayerIds: null,
      scopedPositionGroups: null,
      scopedUnit: null,
      coordinatorType: null,
    }
  }
  
  // Coordinators create events for their unit
  if (creatorRole === "ASSISTANT_COACH") {
    const coordinatorType = getCoordinatorType({ permissions: creatorPermissions })
    if (coordinatorType) {
      const unit = getCoordinatorUnit(coordinatorType)
      return {
        scopedPlayerIds: null,
        scopedPositionGroups: null,
        scopedUnit: unit,
        coordinatorType,
      }
    }
    
    // Position coaches create events for their position group
    if (creatorPositionGroups && creatorPositionGroups.length > 0) {
      return {
        scopedPlayerIds: null,
        scopedPositionGroups: creatorPositionGroups,
        scopedUnit: null,
        coordinatorType: null,
      }
    }
  }
  
  // Default: no scoping (shouldn't happen for event creation)
  return {
    scopedPlayerIds: null,
    scopedPositionGroups: null,
    scopedUnit: null,
    coordinatorType: null,
  }
}
