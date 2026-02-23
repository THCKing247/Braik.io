/**
 * Program Codes Utilities
 * Handles generation and management of program codes (player code and parent code)
 */

import { prisma } from "./prisma"
import { randomBytes } from "crypto"

/**
 * Generate a unique 8-character alphanumeric code
 */
export function generateProgramCode(): string {
  return randomBytes(4).toString('hex').toUpperCase().slice(0, 8)
}

/**
 * Ensure team has player and parent codes generated
 * Called when roster is created/updated
 */
export async function ensureProgramCodes(teamId: string): Promise<{ playerCode: string | null; parentCode: string | null }> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { playerCode: true, parentCode: true },
  })

  if (!team) {
    throw new Error("Team not found")
  }

  let needsUpdate = false
  const updateData: { playerCode?: string; parentCode?: string } = {}

  // Generate player code if missing
  if (!team.playerCode) {
    let playerCode = generateProgramCode()
    // Ensure uniqueness
    let attempts = 0
    while (await prisma.team.findFirst({ where: { playerCode, id: { not: teamId } } })) {
      playerCode = generateProgramCode()
      attempts++
      if (attempts > 10) {
        throw new Error("Failed to generate unique player code")
      }
    }
    updateData.playerCode = playerCode
    needsUpdate = true
  }

  // Generate parent code if missing
  if (!team.parentCode) {
    let parentCode = generateProgramCode()
    // Ensure uniqueness
    let attempts = 0
    while (await prisma.team.findFirst({ where: { parentCode, id: { not: teamId } } })) {
      parentCode = generateProgramCode()
      attempts++
      if (attempts > 10) {
        throw new Error("Failed to generate unique parent code")
      }
    }
    updateData.parentCode = parentCode
    needsUpdate = true
  }

  if (needsUpdate) {
    const updated = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
      select: { playerCode: true, parentCode: true },
    })
    return {
      playerCode: updated.playerCode,
      parentCode: updated.parentCode,
    }
  }

  return {
    playerCode: team.playerCode,
    parentCode: team.parentCode,
  }
}
