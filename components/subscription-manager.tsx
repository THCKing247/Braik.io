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
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-[#FFFFFF]">Subscription Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[#FFFFFF]/70 mb-1">Player Count</p>
              <p className="text-2xl font-bold text-[#FFFFFF]">{playerCount}</p>
            </div>
            <div>
              <p className="text-sm text-[#FFFFFF]/70 mb-1">Subscription Amount</p>
              <p className="text-2xl font-bold text-[#FFFFFF]">${subscriptionAmount.toFixed(2)}</p>
              <p className="text-xs text-[#FFFFFF]/70">$5.00 per player</p>
            </div>
            <div>
              <p className="text-sm text-[#FFFFFF]/70 mb-1">Amount Paid</p>
              <p className="text-2xl font-bold text-green-400">${amountPaid.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-[#FFFFFF]/70 mb-1">Remaining Balance</p>
              <p className="text-2xl font-bold text-red-400">${remainingBalance.toFixed(2)}</p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#FFFFFF]/20">
            {subscriptionPaid ? (
              <div className="p-4 bg-green-500/20 border border-green-500/30 rounded">
                <p className="text-green-400 font-semibold">✓ Subscription Active</p>
                <p className="text-sm text-[#FFFFFF]/70 mt-1">Your subscription is fully paid and active.</p>
              </div>
            ) : (
              <div className="p-4 bg-yellow-500/20 border border-yellow-500/30 rounded">
                <p className="text-yellow-400 font-semibold">⚠ Subscription Pending</p>
                <p className="text-sm text-[#FFFFFF]/70 mt-1">
                  Please complete payment to access all features. Remaining balance: ${remainingBalance.toFixed(2)}
                </p>
              </div>
            )}
          </div>

          {isHeadCoach && (
            <div className="flex gap-4">
              <Link href="/dashboard/collections">
                <Button className="bg-[#1e3a5f] text-[#FFFFFF] hover:bg-[#2d4a6f]">
                  Manage Payments
                </Button>
              </Link>
              {!subscriptionPaid && (
                <Button
                  variant="outline"
                  onClick={handleUpdatePayment}
                  className="bg-[#FFFFFF] text-[#1e3a5f] hover:bg-[#F1F5F9]"
                >
                  Update Payment Information
                </Button>
              )}
            </div>
          )}
          
          {!isHeadCoach && (
            <div className="p-4 bg-[#FFFFFF]/10 rounded border border-[#FFFFFF]/20">
              <p className="text-sm text-[#FFFFFF]/70">
                Only Head Coaches can manage payments. Contact your Head Coach for payment updates.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team ID Code - Head Coach Only */}
      {isHeadCoach && teamIdCode && (
        <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
          <CardHeader>
            <CardTitle className="text-[#FFFFFF]">Team ID Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-[#FFFFFF]/80">
              Share this Team ID code with Assistant Coaches, Players, and Parents so they can join your team.
            </p>
            <div className="p-6 bg-[#FFFFFF]/10 rounded-lg border border-[#FFFFFF]/20">
              <p className="text-sm text-[#FFFFFF]/70 mb-2">Team ID Code</p>
              <p className="text-4xl font-bold text-[#FFFFFF] font-mono tracking-wider">{teamIdCode}</p>
            </div>
            <p className="text-xs text-[#FFFFFF]/70">
              This code is required when other users sign up to join your team.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payment Information - Head Coach Only */}
      {isHeadCoach && (
        <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
          <CardHeader>
            <CardTitle className="text-[#FFFFFF]">Payment Information</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[#FFFFFF]/80 mb-4">
              Stripe payment integration coming soon. For now, you can track payments through the Collections page.
            </p>
            <Link href="/dashboard/collections">
              <Button variant="outline" className="bg-[#FFFFFF] text-[#1e3a5f] hover:bg-[#F1F5F9]">
                Go to Collections
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
