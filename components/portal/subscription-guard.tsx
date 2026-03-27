"use client"

import { useSession } from "@/lib/auth/client-auth"
import { useDashboardShellIdentity } from "@/lib/hooks/use-dashboard-shell-identity"

interface SubscriptionGuardProps {
  subscriptionPaid: boolean
  remainingBalance: number
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const identity = useDashboardShellIdentity()
  const { status } = useSession()

  // Avoid flashing gated UI while shell identity or session is still resolving
  if (identity.bootstrapLoading || (!identity.hasIdentity && status === "loading")) {
    return <>{children}</>
  }

  // Full access for all users — paywall disabled; everyone can see all pages
  return <>{children}</>

}
