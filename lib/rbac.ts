import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ROLES } from "@/lib/roles"

/** Permission to role mapping: who can do what */
const PERMISSION_ROLES: Record<string, readonly string[]> = {
  post_announcements: [ROLES.HEAD_COACH, ROLES.ASSISTANT_COACH],
}

/**
 * Get the current user's membership for a team, or null if not a member.
 * Uses the current session; must be called from a route that has already validated session.
 */
export async function getUserMembership(teamId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      teamId,
    },
  })
  return membership
}

/**
 * Check that the current user has the given permission for the team.
 * Returns a 403 NextResponse if denied, or null if allowed.
 * Caller should: const res = await requireTeamPermission(teamId, "permission"); if (res) return res
 */
export async function requireTeamPermission(
  teamId: string,
  permission: string
): Promise<NextResponse | null> {
  const membership = await getUserMembership(teamId)
  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const allowedRoles = PERMISSION_ROLES[permission]
  if (!allowedRoles || !allowedRoles.includes(membership.role)) {
    return NextResponse.json(
      { error: "You do not have permission to perform this action" },
      { status: 403 }
    )
  }
  return null
}
