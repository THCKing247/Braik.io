import { prisma } from "@/lib/prisma"

export type CreateNotificationsParams = {
  type: string
  teamId: string
  title: string
  body: string
  linkUrl?: string
  linkType?: string
  linkId?: string
  metadata?: Record<string, unknown>
  /** If set, only these users receive the notification. */
  targetUserIds?: string[]
  /** If set, all team members except these users receive the notification. */
  excludeUserIds?: string[]
}

/**
 * Create in-app notifications for team members.
 * Use targetUserIds to notify specific users, or excludeUserIds to notify everyone except certain users.
 */
export async function createNotifications(
  params: CreateNotificationsParams
): Promise<void> {
  const {
    type,
    teamId,
    title,
    body,
    linkUrl,
    linkType,
    linkId,
    metadata,
    targetUserIds,
    excludeUserIds,
  } = params

  let userIds: string[]

  if (targetUserIds?.length) {
    userIds = targetUserIds
  } else {
    const memberships = await prisma.membership.findMany({
      where: { teamId },
      select: { userId: true },
    })
    const all = memberships.map((m: { userId: string }) => m.userId).filter(Boolean) as string[]
    const exclude = new Set(excludeUserIds ?? [])
    userIds = all.filter((id) => !exclude.has(id))
  }

  if (userIds.length === 0) return

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      teamId,
      userId,
      type,
      title,
      body,
      linkUrl: linkUrl ?? null,
      linkType: linkType ?? null,
      linkId: linkId ?? null,
      ...(metadata != null && { metadata: metadata as object }),
      read: false,
    })),
  })
}
