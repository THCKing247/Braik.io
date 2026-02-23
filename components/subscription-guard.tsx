"use client"

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface SubscriptionGuardProps {
  subscriptionPaid: boolean
  remainingBalance: number
  children: React.ReactNode
}

export function SubscriptionGuard({ subscriptionPaid, remainingBalance, children }: SubscriptionGuardProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  
  // Wait for session to load
  if (status === "loading") {
    return <>{children}</>
  }
  
  const isHeadCoach = session?.user?.role === "HEAD_COACH"
  
  // Allow access to subscription and collections pages
  const allowedPaths = ["/dashboard/subscription", "/dashboard/collections"]
  const isAllowedPath = allowedPaths.some(path => pathname?.startsWith(path))

  // Head Coach can always access dashboard (they need to see Team ID code)
  // Other roles need subscription paid
  if (subscriptionPaid || isAllowedPath || isHeadCoach) {
    return <>{children}</>
  }

  // Otherwise, show subscription required message
  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-2xl text-[#FFFFFF]">Subscription Required</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-[#FFFFFF]/80">
            Your subscription payment is required to access all features. Please complete your payment to continue.
          </p>
          <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded">
            <p className="text-yellow-400 font-semibold">Remaining Balance: ${remainingBalance.toFixed(2)}</p>
          </div>
          <div className="flex gap-4">
            <Link href="/dashboard/collections">
              <Button className="bg-[#1e3a5f] text-[#FFFFFF] hover:bg-[#2d4a6f]">
                Go to Collections
              </Button>
            </Link>
            <Link href="/dashboard/subscription">
              <Button variant="outline" className="bg-[#FFFFFF] text-[#1e3a5f] hover:bg-[#F1F5F9]">
                View Subscription
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
