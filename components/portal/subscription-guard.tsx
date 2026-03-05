"use client"

import { useSession } from "@/lib/auth/client-auth"

interface SubscriptionGuardProps {
  subscriptionPaid: boolean
  remainingBalance: number
  children: React.ReactNode
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { status } = useSession()

  // Wait for session to load
  if (status === "loading") {
    return <>{children}</>
  }

  // Full access for all users — paywall disabled; everyone can see all pages
  return <>{children}</>

}
