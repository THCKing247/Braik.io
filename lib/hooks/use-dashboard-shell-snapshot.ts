"use client"

import { useMemo } from "react"
import { useSession } from "@/lib/auth/client-auth"
import { usePortalTeam } from "@/components/portal/portal-team-context"

/**
 * Stable, minimal snapshot combining client session with shell team ids from the layout.
 * Prefer this over re-fetching profile/team when you only need ids/role for API query params.
 */
export function useDashboardShellSnapshot() {
  const { data, status } = useSession()
  const portal = usePortalTeam()

  return useMemo(
    () => ({
      authStatus: status,
      userId: data?.user?.id,
      email: data?.user?.email,
      name: data?.user?.name,
      role: data?.user?.role,
      sessionTeamId: data?.user?.teamId,
      isPlatformOwner: data?.user?.isPlatformOwner,
      shellTeamIds: portal?.teamIds ?? [],
      shellCurrentTeamId: portal?.currentTeamId ?? "",
    }),
    [
      status,
      data?.user?.id,
      data?.user?.email,
      data?.user?.name,
      data?.user?.role,
      data?.user?.teamId,
      data?.user?.isPlatformOwner,
      portal?.teamIds,
      portal?.currentTeamId,
    ]
  )
}
