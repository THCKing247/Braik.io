"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"

interface Team {
  id: string
  duesAmount: number
  duesDueDate: Date | null
  players: Array<{ id: string }>
}

interface BillingSettingsProps {
  team: Team
}

export function BillingSettings({ team }: BillingSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [editingDues, setEditingDues] = useState(false)
  const [duesAmount, setDuesAmount] = useState(team.duesAmount.toString())
  const [duesDueDate, setDuesDueDate] = useState(
    team.duesDueDate ? new Date(team.duesDueDate).toISOString().split("T")[0] : ""
  )

  const handleSaveDues = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duesAmount: parseFloat(duesAmount),
          duesDueDate: duesDueDate || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update dues amount")
      }

      alert("Dues amount updated successfully!")
      setEditingDues(false)
      window.location.reload()
    } catch (error: any) {
      alert(error.message || "Error updating dues amount")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Dues Amount */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Roster Dues</CardTitle>
          <CardDescription className="text-white/70">
            Set the per-player subscription amount for roster dues
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!editingDues ? (
            <div className="space-y-4">
              <div>
                <Label className="text-white/70">Dues Amount</Label>
                <p className="text-white font-medium text-2xl">${team.duesAmount.toFixed(2)}</p>
                <p className="text-sm text-white/60 mt-1">
                  Per player × {team.players.length} players = ${(team.duesAmount * team.players.length).toFixed(2)} total
                </p>
              </div>
              {team.duesDueDate && (
                <div>
                  <Label className="text-white/70">Due Date</Label>
                  <p className="text-white font-medium">
                    {new Date(team.duesDueDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              <Button onClick={() => setEditingDues(true)}>Edit Dues Amount</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="duesAmount" className="text-white">Dues Amount ($) *</Label>
                <Input
                  id="duesAmount"
                  type="number"
                  step="0.01"
                  value={duesAmount}
                  onChange={(e) => setDuesAmount(e.target.value)}
                  placeholder="5.00"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duesDueDate" className="text-white">Due Date</Label>
                <Input
                  id="duesDueDate"
                  type="date"
                  value={duesDueDate}
                  onChange={(e) => setDuesDueDate(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveDues} disabled={loading}>
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingDues(false)
                    setDuesAmount(team.duesAmount.toString())
                    setDuesDueDate(
                      team.duesDueDate ? new Date(team.duesDueDate).toISOString().split("T")[0] : ""
                    )
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Payment Method</CardTitle>
          <CardDescription className="text-white/70">
            Manage payment methods for team subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-white/70">Payment method setup coming soon</p>
            <p className="text-sm text-white/60">
              You&apos;ll be able to add and manage credit cards and other payment methods here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Billing History</CardTitle>
          <CardDescription className="text-white/70">
            View past payments and invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-white/70">Billing history coming soon</p>
            <p className="text-sm text-white/60">
              View and download past invoices and payment receipts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Collections Link */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Collections</CardTitle>
          <CardDescription className="text-white/70">
            Manage payment collections and track invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/collections">
            <Button className="w-full">View Collections Overview</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
