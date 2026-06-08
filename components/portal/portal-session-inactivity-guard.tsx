"use client"

import { usePathname } from "next/navigation"
import { useSession } from "@/lib/auth/client-auth"
import { usePortalSessionInactivity } from "@/lib/hooks/use-portal-session-inactivity"
import { isPortalAuthenticatedPath } from "@/lib/auth/session-inactivity-policy"
import { PortalSessionInactivityWarning } from "@/components/portal/portal-session-inactivity-warning"

export function PortalSessionInactivityGuard() {
  const pathname = usePathname() ?? ""
  const session = useSession()
  const onPortal =
    isPortalAuthenticatedPath(pathname) && session.status === "authenticated"

  const { warningOpen, secondsRemaining, dismissWarningAndExtend } =
    usePortalSessionInactivity(onPortal)

  if (!onPortal) return null

  return (
    <PortalSessionInactivityWarning
      open={warningOpen}
      secondsRemaining={secondsRemaining}
      onStillHere={dismissWarningAndExtend}
    />
  )
}
