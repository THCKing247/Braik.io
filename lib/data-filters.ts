export async function getParentAccessiblePlayerIds(
  _userId: string,
  _teamId: string
): Promise<string[]> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

export function getAssistantCoachPositionGroups(positionGroups: any): string[] | null {
  if (!positionGroups || !Array.isArray(positionGroups)) {
    return null
  }
  return positionGroups
}

export function canAssistantCoachAccessPlayer(
  playerPositionGroup: string | null,
  assistantPositionGroups: string[] | null
): boolean {
  if (!assistantPositionGroups || assistantPositionGroups.length === 0) {
    return true
  }
  if (!playerPositionGroup) {
    return false
  }
  return assistantPositionGroups.includes(playerPositionGroup)
}

export async function buildPlayerFilter(
  _userId: string,
  _role: string,
  _teamId: string,
  _positionGroups?: string[] | null
): Promise<any> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}
