"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import Link from "next/link"
import { prefetchPropForDashboardScheduleHref } from "@/lib/navigation/dashboard-schedule-prefetch"
import { DatePicker, dateToYmd, ymdToDate } from "@/components/portal/date-time-picker"

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
  const [duesDueDate, setDuesDueDate] = useState<Date | null>(() =>
    team.duesDueDate ? ymdToDate(new Date(team.duesDueDate).toISOString().split("T")[0]) : null
  )

  const handleSaveDues = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${team.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duesAmount: parseFloat(duesAmount),
          duesDueDate: duesDueDate ? dateToYmd(duesDueDate) : null,
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
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Roster Dues</CardTitle>
          <CardDescription className="text-muted-foreground">
            Set the per-player subscription amount for roster dues
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!editingDues ? (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Dues Amount</Label>
                <p className="text-foreground font-medium text-2xl">${team.duesAmount.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Per player × {team.players.length} players = ${(team.duesAmount * team.players.length).toFixed(2)} total
                </p>
              </div>
              {team.duesDueDate && (
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p className="text-foreground font-medium">
                    {new Date(team.duesDueDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              <Button onClick={() => setEditingDues(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">Edit Dues Amount</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="duesAmount" className="text-foreground">Dues Amount ($) *</Label>
                <Input
                  id="duesAmount"
                  type="number"
                  step="0.01"
                  value={duesAmount}
                  onChange={(e) => setDuesAmount(e.target.value)}
                  placeholder="5.00"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <DatePicker
                id="duesDueDate"
                label="Due Date"
                value={duesDueDate}
                onChange={setDuesDueDate}
                placeholder="Select due date"
                allowClear
              />
              <div className="flex gap-2">
                <Button onClick={handleSaveDues} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingDues(false)
                    setDuesAmount(team.duesAmount.toString())
                    setDuesDueDate(
                      team.duesDueDate
                        ? ymdToDate(new Date(team.duesDueDate).toISOString().split("T")[0])
                        : null
                    )
                  }}
                  className="border-border text-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Payment Method</CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage payment methods for team subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">Payment method setup coming soon</p>
            <p className="text-sm text-muted-foreground">
              You&apos;ll be able to add and manage credit cards and other payment methods here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Billing History</CardTitle>
          <CardDescription className="text-muted-foreground">
            View past payments and invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-muted-foreground">Billing history coming soon</p>
            <p className="text-sm text-muted-foreground">
              View and download past invoices and payment receipts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Collections Link */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Collections</CardTitle>
          <CardDescription className="text-muted-foreground">
            Manage payment collections and track invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/collections" prefetch={prefetchPropForDashboardScheduleHref("/dashboard/collections")}>
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">View Collections Overview</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
