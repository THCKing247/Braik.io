"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CreditCard, CheckCircle, XCircle } from "lucide-react"

interface CardIntegrationSettingsProps {
  teamId: string
}

interface PaymentAccount {
  id: string
  provider: string
  status: string
  connected: boolean
}

export function CardIntegrationSettings({ teamId }: CardIntegrationSettingsProps) {
  const [loading, setLoading] = useState(false)
  const [account, setAccount] = useState<PaymentAccount | null>(null)
  const [showConnectForm, setShowConnectForm] = useState(false)

  useEffect(() => {
    loadAccountStatus()
  }, [teamId])

  const loadAccountStatus = async () => {
    try {
      const response = await fetch(`/api/teams/${teamId}/payments/coach/status`)
      if (response.ok) {
        const data = await response.json()
        setAccount({
          id: data.account?.id || "",
          provider: data.provider || "stripe",
          status: data.status || "not_connected",
          connected: data.connected || false,
        })
      }
    } catch (error) {
      console.error("Error loading account status:", error)
    }
  }

  const handleConnect = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/payments/coach/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "stripe" }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to connect account")
      }

      const data = await response.json()
      alert(
        "Payment account connection initiated. In production, you would be redirected to complete the onboarding process."
      )
      loadAccountStatus()
      setShowConnectForm(false)
    } catch (error: any) {
      alert(error.message || "Error connecting account")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Card Integration
          </CardTitle>
          <CardDescription className="text-white/70">
            Connect your payment account to collect payments from parents and players
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {account?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Payment account connected</span>
              </div>
              <div className="space-y-2">
                <p className="text-white/70">Provider</p>
                <p className="text-white font-medium capitalize">{account.provider}</p>
              </div>
              <div className="space-y-2">
                <p className="text-white/70">Status</p>
                <p className="text-white font-medium capitalize">{account.status}</p>
              </div>
              <p className="text-sm text-white/60">
                Your payment account is connected and ready to collect payments. You can manage
                collections in the Invoice section.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-yellow-400">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">No payment account connected</span>
              </div>
              <p className="text-white/70">
                Connect a payment account to collect payments from parents and players for gear,
                camps, fundraisers, and other custom fees.
              </p>
              {!showConnectForm ? (
                <Button onClick={() => setShowConnectForm(true)}>Connect Payment Account</Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-white/60">
                    Click below to start the connection process. You&apos;ll be redirected to
                    complete the onboarding.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={handleConnect} disabled={loading}>
                      {loading ? "Connecting..." : "Connect Stripe Account"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowConnectForm(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
