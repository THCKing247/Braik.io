"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Payment {
  id: string
  amount: number
  status: string
  paidAt: Date | null
  createdAt: Date
}

interface Player {
  id: string
  firstName: string
  lastName: string
  payments: Payment[]
  guardianLinks: Array<{
    guardian: { user: { email: string } }
  }>
}

interface Team {
  id: string
  duesAmount: number
  duesDueDate: Date | null
}

interface Membership {
  role: string
}

interface PaymentsManagerProps {
  team: Team
  players: Player[]
  membership: Membership
  currentUserId?: string
}

export function PaymentsManager({ team, players, membership, currentUserId }: PaymentsManagerProps) {
  const canViewPayments = membership.role === "HEAD_COACH" || membership.role === "ASSISTANT_COACH"
  const canPay = membership.role === "PARENT"
  const canMarkPaid = membership.role === "HEAD_COACH"

  const handlePay = async (playerId: string) => {
    try {
      const response = await fetch("/api/payments/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, playerId }),
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      alert("Error initiating payment")
    }
  }

  const handleMarkPaid = async (playerId: string) => {
    if (!confirm("Mark this payment as paid manually?")) {
      return
    }

    try {
      const response = await fetch("/api/payments/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: team.id, playerId }),
      })

      if (!response.ok) {
        throw new Error("Failed to mark as paid")
      }

      // Reload page to refresh data
      window.location.reload()
    } catch (error) {
      alert("Error marking payment as paid")
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/payments/export?teamId=${team.id}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `payments-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (error) {
      alert("Error exporting payments")
    }
  }

  const paidCount = players.filter((p) => p.payments.some((pay) => pay.status === "completed")).length
  const unpaidCount = players.length - paidCount
  const pastDue = team.duesDueDate && new Date(team.duesDueDate) < new Date() ? unpaidCount : 0

  return (
    <div>
      {canViewPayments && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{paidCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Unpaid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-danger">{unpaidCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Past Due</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{pastDue}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {canViewPayments && (
        <div className="mb-6">
          <Button onClick={handleExport}>Export CSV</Button>
        </div>
      )}

      <div className="grid gap-4">
        {players.map((player) => {
          const latestPayment = player.payments[0]
          const isPaid = latestPayment?.status === "completed"
          const needsPayment = !isPaid

          return (
            <Card key={player.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg" style={{ color: "rgb(var(--text))" }}>
                      {player.firstName} {player.lastName}
                    </h3>
                    <div className="text-sm mt-1" style={{ color: "rgb(var(--text2))" }}>
                      {player.guardianLinks.length > 0 && (
                        <div>Guardians: {player.guardianLinks.map((link) => link.guardian.user.email).join(", ")}</div>
                      )}
                      {latestPayment && (
                        <div>
                          Status: <span style={{ color: "rgb(var(--text2))" }}>{latestPayment.status}</span>
                          {latestPayment.paidAt && ` • Paid: ${new Date(latestPayment.paidAt).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {canViewPayments && (
                      <div className="text-right">
                        <div className="text-sm" style={{ color: "rgb(var(--text2))" }}>Amount: ${team.duesAmount}</div>
                        <span className="text-sm" style={{ color: "rgb(var(--text2))" }}>
                          {isPaid ? "✓ Paid" : "Unpaid"}
                        </span>
                      </div>
                    )}
                    {canPay && needsPayment && player.guardianLinks.length > 0 && (
                      <Button 
                        onClick={() => handlePay(player.id)}
                        style={{
                          backgroundColor: "rgb(var(--gunmetal))",
                          color: "#FFFFFF"
                        }}
                      >
                        Pay ${team.duesAmount}
                      </Button>
                    )}
                    {canMarkPaid && needsPayment && (
                      <Button 
                        variant="outline" 
                        onClick={() => handleMarkPaid(player.id)}
                        style={{
                          borderColor: "rgb(var(--border))",
                          color: "rgb(var(--text))"
                        }}
                      >
                        Mark as Paid
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

