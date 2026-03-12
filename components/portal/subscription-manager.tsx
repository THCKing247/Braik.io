"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

interface Team {
  id: string
  name: string
  subscriptionPaid: boolean
  subscriptionAmount: number
  amountPaid: number
}

interface SubscriptionManagerProps {
  team: Team
  playerCount: number
  subscriptionAmount: number
  amountPaid: number
  remainingBalance: number
  subscriptionPaid: boolean
  isHeadCoach: boolean
  teamIdCode: string
}

export function SubscriptionManager({
  team,
  playerCount,
  subscriptionAmount,
  amountPaid,
  remainingBalance,
  subscriptionPaid,
  isHeadCoach,
  teamIdCode,
}: SubscriptionManagerProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleUpdatePayment = async () => {
    // Redirect to collections page for payment management
    window.location.href = "/dashboard/collections"
  }

  return (
    <div className="space-y-6">
      {/* Subscription Status */}
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            SUBSCRIPTION STATUS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm mb-1" style={{ color: "rgb(var(--muted))" }}>Player Count</p>
              <p className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>{playerCount}</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: "rgb(var(--muted))" }}>Subscription Amount</p>
              <p className="text-2xl font-bold" style={{ color: "rgb(var(--text))" }}>${subscriptionAmount.toFixed(2)}</p>
              <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>$5.00 per player</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: "rgb(var(--muted))" }}>Amount Paid</p>
              <p className="text-2xl font-bold" style={{ color: "#10b981" }}>${amountPaid.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm mb-1" style={{ color: "rgb(var(--muted))" }}>Remaining Balance</p>
              <p className="text-2xl font-bold" style={{ color: "#ef4444" }}>${remainingBalance.toFixed(2)}</p>
            </div>
          </div>

          <div className="pt-4 border-t" style={{ borderColor: "rgb(var(--border))" }}>
            {subscriptionPaid ? (
              <div className="p-4 rounded border" style={{ backgroundColor: "#d1fae5", borderColor: "#10b981" }}>
                <p className="font-semibold" style={{ color: "#059669" }}>✓ Subscription Active</p>
                <p className="text-sm mt-1" style={{ color: "rgb(var(--muted))" }}>Your subscription is fully paid and active.</p>
              </div>
            ) : (
              <div className="p-4 rounded border" style={{ backgroundColor: "#fef3c7", borderColor: "#f59e0b" }}>
                <p className="font-semibold" style={{ color: "#d97706" }}>⚠ Subscription Pending</p>
                <p className="text-sm mt-1" style={{ color: "rgb(var(--muted))" }}>
                  Please complete payment to access all features. Remaining balance: ${remainingBalance.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {isHeadCoach && (
            <div className="flex gap-4">
              <Link href="/dashboard/collections">
                <Button style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}>
                  Manage Payments
                </Button>
              </Link>
              {!subscriptionPaid && (
                <Button
                  variant="outline"
                  onClick={handleUpdatePayment}
                  style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                >
                  Update Payment Information
                </Button>
              )}
            </div>
          )}
          
          {!isHeadCoach && (
            <div className="p-4 rounded border" style={{ backgroundColor: "rgb(var(--platinum))", borderColor: "rgb(var(--border))" }}>
              <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                Only Head Coaches can manage payments. Contact your Head Coach for payment updates.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Code - Head Coach Only */}
      {isHeadCoach && (
        <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
          <CardHeader>
            <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
              TEAM CODE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {teamIdCode ? (
              <>
                <p style={{ color: "rgb(var(--muted))" }}>
                  Share this team code with Assistant Coaches, Players, and Parents so they can join your team.
                </p>
                <div className="p-6 rounded-lg border" style={{ backgroundColor: "rgb(var(--platinum))", borderColor: "rgb(var(--border))" }}>
                  <p className="text-sm mb-2" style={{ color: "rgb(var(--muted))" }}>Team Code</p>
                  <p className="text-4xl font-bold font-mono tracking-wider" style={{ color: "rgb(var(--text))" }}>{teamIdCode}</p>
                </div>
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  This code is required when other users sign up to join your team. You can also manage it in Settings.
                </p>
              </>
            ) : (
              <>
                <p style={{ color: "rgb(var(--muted))" }}>
                  No team code has been generated yet. Generate one in Settings so others can join your team.
                </p>
                <Link href="/dashboard/settings">
                  <Button variant="outline" style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}>
                    Go to Settings to generate Team Code
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Information - Head Coach Only */}
      {isHeadCoach && (
        <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
          <CardHeader>
            <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
              PAYMENT INFORMATION
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4" style={{ color: "rgb(var(--muted))" }}>
              Stripe payment integration coming soon. For now, you can track payments through the Collections page.
            </p>
            <Link href="/dashboard/collections">
              <Button variant="outline" style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}>
                Go to Collections
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
