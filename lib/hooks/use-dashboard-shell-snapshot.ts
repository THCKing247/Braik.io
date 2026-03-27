"use client"

import { useMemo } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"
import { usePortalTeam } from "@/components/portal/portal-team-context"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"

/**
 * Stable, minimal snapshot: team shell bootstrap + portal team ids, with session only for authStatus.
 * Prefer `useDashboardShellIdentity` for display; this hook adds portal routing fields.
 */
export function useDashboardShellSnapshot() {
  const identity = useDashboardShellIdentity()
  const shell = useAppBootstrapOptional()
  const { status } = useSession()
  const portal = usePortalTeam()

  return useMemo(
    () => ({
      authStatus: status,
      userId: identity.userId || undefined,
      email: identity.email || undefined,
      name: identity.displayName ?? undefined,
      role: identity.roleUpper,
      sessionTeamId: identity.sessionUser?.teamId,
      isPlatformOwner: identity.isPlatformOwner,
      shellTeamIds: portal?.teamIds ?? [],
      shellCurrentTeamId: portal?.currentTeamId ?? "",
      bootstrapTeamId: shell?.payload?.team.id ?? shell?.teamId,
    }),
    [
      status,
      identity.userId,
      identity.email,
      identity.displayName,
      identity.roleUpper,
      identity.sessionUser?.teamId,
      identity.isPlatformOwner,
      portal?.teamIds,
      portal?.currentTeamId,
      shell?.payload?.team.id,
      shell?.teamId,
    ]
  )
}
