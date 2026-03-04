export async function ensureGeneralChatThread(_teamId: string): Promise<string> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

export async function ensureParentPlayerCoachChat(
  _teamId: string,
  _parentUserId: string,
  _playerId: string
): Promise<string> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}
