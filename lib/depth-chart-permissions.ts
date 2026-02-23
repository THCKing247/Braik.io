/**
 * Depth Chart Permissions Utilities
 * Implements hierarchical depth chart editing authority per BRAIK_MASTER_INTENT.md
 * 
 * Hierarchy:
 * - Head Coach → all units
 * - OC → offense only
 * - DC → defense only
 * - ST → special teams only
 * - Position coaches → their position group only
 * - Players/Parents → read-only
 */

import { getCoordinatorType, getCoordinatorUnit, getUnitForPositionGroup, type CoordinatorType, type Unit } from "./calendar-hierarchy"

export type DepthChartUnit = "offense" | "defense" | "special_teams"

/**
 * Map depth chart unit string to calendar unit type
 */
export function mapDepthChartUnitToUnit(unit: DepthChartUnit): Unit {
  switch (unit) {
    case "offense":
      return "OFFENSE"
    case "defense":
      return "DEFENSE"
    case "special_teams":
      return "SPECIAL_TEAMS"
    default:
      return null
  }
}

/**
 * Check if a user can edit depth charts for a specific unit
 */
export function canEditDepthChartUnit(
  membership: {
    role: string
    permissions?: any
    positionGroups?: any
  },
  unit: DepthChartUnit
): boolean {
  // Head Coach can edit all units
  if (membership.role === "HEAD_COACH") {
    return true
  }

  // Players and parents cannot edit (read-only)
  if (membership.role === "PLAYER" || membership.role === "PARENT") {
    return false
  }

  // Assistant coaches need to be checked for coordinator or position coach permissions
  if (membership.role === "ASSISTANT_COACH") {
    const coordinatorType = getCoordinatorType(membership)
    const targetUnit = mapDepthChartUnitToUnit(unit)

    // Check if they're a coordinator for this unit
    if (coordinatorType) {
      const coordinatorUnit = getCoordinatorUnit(coordinatorType)
      if (coordinatorUnit === targetUnit) {
        return true
      }
    }

    // Position coaches can edit if they have position groups that belong to this unit
    const positionGroups = membership.positionGroups as string[] | null
    if (positionGroups && Array.isArray(positionGroups) && positionGroups.length > 0) {
      // Check if any of their position groups belong to the target unit
      for (const pg of positionGroups) {
        const pgUnit = getUnitForPositionGroup(pg)
        if (pgUnit === targetUnit) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Check if a user can edit a specific position in the depth chart
 * Position coaches can only edit positions in their assigned position groups
 */
export function canEditDepthChartPosition(
  membership: {
    role: string
    permissions?: any
    positionGroups?: any
  },
  unit: DepthChartUnit,
  position: string
): boolean {
  // First check unit-level permission
  if (!canEditDepthChartUnit(membership, unit)) {
    return false
  }

  // Head Coach and coordinators can edit all positions in their unit
  if (membership.role === "HEAD_COACH") {
    return true
  }

  if (membership.role === "ASSISTANT_COACH") {
    const coordinatorType = getCoordinatorType(membership)
    if (coordinatorType) {
      // Coordinators can edit all positions in their unit
      return true
    }

    // Position coaches can only edit positions matching their position groups
    const positionGroups = membership.positionGroups as string[] | null
    if (positionGroups && Array.isArray(positionGroups) && positionGroups.length > 0) {
      // Map position to position group
      // For special teams, positions are more granular (L1, L2, etc.)
      // For offense/defense, we need to map positions like "QB", "RB", etc. to position groups
      const positionUpper = position.toUpperCase()
      
      // Check if position matches any of their position groups
      for (const pg of positionGroups) {
        const pgUpper = pg.toUpperCase()
        
        // Direct match
        if (positionUpper === pgUpper) {
          return true
        }
        
        // Map common position abbreviations to position groups
        // Offense
        if (unit === "offense") {
          if (pgUpper === "OL" && ["LT", "LG", "C", "RG", "RT"].includes(positionUpper)) {
            return true
          }
          if (pgUpper === "WR" && ["WR", "WRX", "WRY", "WRZ", "WR1", "WR2", "WR3"].includes(positionUpper)) {
            return true
          }
          if (pgUpper === "RB" && ["RB", "HB", "FB"].includes(positionUpper)) {
            return true
          }
          if (pgUpper === "TE" && positionUpper === "TE") {
            return true
          }
          if (pgUpper === "QB" && positionUpper === "QB") {
            return true
          }
        }
        
        // Defense
        if (unit === "defense") {
          if (pgUpper === "DL" && ["DE", "DT", "DL"].includes(positionUpper)) {
            return true
          }
          if (pgUpper === "LB" && ["OLB", "ILB", "MLB", "LB"].includes(positionUpper)) {
            return true
          }
          if (pgUpper === "DB" && ["CB", "S", "FS", "SS", "DB"].includes(positionUpper)) {
            return true
          }
        }
        
        // Special teams - position coaches typically don't manage special teams positions
        // But if they have K, P, LS, etc., they can edit those
        if (unit === "special_teams") {
          if (pgUpper === "K" && positionUpper === "K") {
            return true
          }
          if (pgUpper === "P" && positionUpper === "P") {
            return true
          }
          if (pgUpper === "LS" && positionUpper === "LS") {
            return true
          }
        }
      }
    }
  }

  return false
}

/**
 * Check if a user can view depth charts (read-only access)
 */
export function canViewDepthChart(membership: { role: string }): boolean {
  // All roles can view depth charts
  return true
}

/**
 * Validate that a player belongs to the team's roster
 */
export async function validatePlayerInRoster(
  teamId: string,
  playerId: string
): Promise<boolean> {
  const { prisma } = await import("./prisma")
  
  try {
    const player = await prisma.player.findFirst({
      where: {
        id: playerId,
        teamId: teamId,
        status: "active", // Only active players can be in depth charts
      },
    })

    return !!player
  } catch (error) {
    console.error("Error validating player in roster:", error)
    return false
  }
}
