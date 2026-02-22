"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
}

interface CollectionsManagerProps {
  teamId: string
  players: Player[]
  subscriptionAmount: number
  amountPaid: number
  remainingBalance: number
  subscriptionPaid: boolean
}

export function CollectionsManager({
  teamId,
  players,
  subscriptionAmount,
  amountPaid,
  remainingBalance,
  subscriptionPaid,
}: CollectionsManagerProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [paidPlayers, setPaidPlayers] = useState<Set<string>>(new Set())

  const handleMarkCashPayment = async (playerId: string) => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/collections/mark-cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, teamId }),
      })

      const data = await response.json()
      if (response.ok) {
        setPaidPlayers(new Set(Array.from(paidPlayers).concat(playerId)))
        router.refresh()
      } else {
        setError(data.error || "Failed to mark payment")
      }
    } catch (err) {
      setError("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handlePayWithCard = async (amount: number, type: "full" | "remaining") => {
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/collections/pay-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          teamId,
          amount,
          type 
        }),
      })

      const data = await response.json()
      if (response.ok) {
        // Redirect to Stripe checkout or handle payment
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl
        } else {
          router.refresh()
        }
      } else {
        setError(data.error || "Failed to process payment")
      }
    } catch (err) {
      setError("An error occurred processing payment")
    } finally {
      setLoading(false)
    }
  }

  const unpaidPlayers = players.filter(p => !paidPlayers.has(p.id) && !subscriptionPaid)
  const allPaid = subscriptionPaid || paidPlayers.size === players.length

  return (
    <div className="space-y-6">
      {/* Subscription Summary */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-[#FFFFFF]">Subscription Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-[#FFFFFF]/70 mb-1">Total Amount</p>
              <p className="text-2xl font-bold text-[#FFFFFF]">${subscriptionAmount.toFixed(2)}</p>
              <p className="text-sm text-[#FFFFFF]/70">{players.length} players × $5.00</p>
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

          {remainingBalance > 0 && (
            <div className="flex gap-4 pt-4 border-t border-[#FFFFFF]/20">
              <Button
                onClick={() => handlePayWithCard(subscriptionAmount, "full")}
                disabled={loading}
                className="bg-[#1e3a5f] text-[#FFFFFF] hover:bg-[#2d4a6f]"
              >
                Pay Full Amount (${subscriptionAmount.toFixed(2)})
              </Button>
              <Button
                onClick={() => handlePayWithCard(remainingBalance, "remaining")}
                disabled={loading}
                variant="outline"
                className="bg-[#FFFFFF] text-[#1e3a5f] hover:bg-[#F1F5F9]"
              >
                Pay Remaining Balance (${remainingBalance.toFixed(2)})
              </Button>
            </div>
          )}

          {subscriptionPaid && (
            <div className="p-4 bg-green-500/20 border border-green-500/30 rounded">
              <p className="text-green-400 font-semibold">✓ Subscription Fully Paid</p>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-500/20 border border-red-500/30 rounded text-red-300">
          {error}
        </div>
      )}

      {/* Unpaid Players */}
      {!allPaid && (
        <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
          <CardHeader>
            <CardTitle className="text-[#FFFFFF]">Unpaid Players ({unpaidPlayers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unpaidPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-4 bg-[#FFFFFF]/10 rounded border border-[#FFFFFF]/20"
                >
                  <div>
                    <p className="text-[#FFFFFF] font-semibold">
                      {player.firstName} {player.lastName}
                      {player.jerseyNumber && ` (#${player.jerseyNumber})`}
                    </p>
                    <p className="text-sm text-[#FFFFFF]/70">Amount: $5.00</p>
                  </div>
                  <Button
                    onClick={() => handleMarkCashPayment(player.id)}
                    disabled={loading}
                    variant="outline"
                    className="bg-[#FFFFFF] text-[#1e3a5f] hover:bg-[#F1F5F9]"
                  >
                    Mark as Cash Payment
                  </Button>
                </div>
              ))}
              {unpaidPlayers.length === 0 && (
                <p className="text-[#FFFFFF]/70 text-center py-8">All players have paid</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Paid Players */}
      {allPaid && players.length > 0 && (
        <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
          <CardHeader>
            <CardTitle className="text-[#FFFFFF]">All Players Paid ({players.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-4 bg-green-500/10 rounded border border-green-500/20"
                >
                  <div>
                    <p className="text-[#FFFFFF] font-semibold">
                      {player.firstName} {player.lastName}
                      {player.jerseyNumber && ` (#${player.jerseyNumber})`}
                    </p>
                    <p className="text-sm text-green-400">Subscription Paid</p>
                  </div>
                  <span className="text-green-400 font-semibold">✓ Paid</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
