"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SubscriptionManagerProps {
  team: Record<string, unknown>
  playerCount: number
  subscriptionAmount: number
  amountPaid: number
  remainingBalance: number
  subscriptionPaid: boolean
  isHeadCoach: boolean
  teamIdCode: string
}

export function SubscriptionManager({
  playerCount,
  subscriptionAmount,
  amountPaid,
  remainingBalance,
  subscriptionPaid,
  teamIdCode,
}: SubscriptionManagerProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">
          Players: {playerCount} × $5.00 = ${subscriptionAmount.toFixed(2)}
        </p>
        <p className="text-sm">Amount paid: ${amountPaid.toFixed(2)}</p>
        <p className="text-sm">Remaining: ${remainingBalance.toFixed(2)}</p>
        <p className="text-sm">Status: {subscriptionPaid ? "Paid" : "Open"}</p>
        {teamIdCode && (
          <p className="text-sm text-muted-foreground">Team code: {teamIdCode}</p>
        )}
      </CardContent>
    </Card>
  )
}
