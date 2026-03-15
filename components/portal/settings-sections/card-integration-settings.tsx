"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CreditCard, CheckCircle, XCircle } from "lucide-react"
import { LEGAL_POLICY_VERSIONS } from "@/lib/audit/compliance-config"

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
  const [showPaymentAckModal, setShowPaymentAckModal] = useState(false)
  const [paymentAckAccepted, setPaymentAckAccepted] = useState(false)

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
        body: JSON.stringify({
          provider: "stripe",
          paymentAckAccepted: true,
          paymentAckVersion: LEGAL_POLICY_VERSIONS.paymentAcknowledgement,
        }),
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
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Card Integration
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Connect your payment account to collect payments from parents and players
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {account?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Payment account connected</span>
              </div>
              <div className="space-y-2">
                <p className="text-muted-foreground">Provider</p>
                <p className="text-foreground font-medium capitalize">{account.provider}</p>
              </div>
              <div className="space-y-2">
                <p className="text-muted-foreground">Status</p>
                <p className="text-foreground font-medium capitalize">{account.status}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Your payment account is connected and ready to collect payments. You can manage
                collections in the Invoice section.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-foreground">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">No payment account connected</span>
              </div>
              <p className="text-muted-foreground">
                Connect a payment account to collect payments from parents and players for gear,
                camps, fundraisers, and other custom fees.
              </p>
              {!showConnectForm ? (
                <Button onClick={() => setShowConnectForm(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">Connect Payment Account</Button>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Click below to start the connection process. You&apos;ll be redirected to
                    complete the onboarding.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setShowPaymentAckModal(true)
                      }}
                      disabled={loading}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {loading ? "Connecting..." : "Connect Stripe Account"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowConnectForm(false)
                      }}
                      className="border-border text-foreground"
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

      {showPaymentAckModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => {
              setShowPaymentAckModal(false)
            }}
            aria-label="Close dues acknowledgment modal"
          />
          <div className="relative w-full max-w-xl rounded-xl border border-border bg-card p-6">
            <h3 className="text-2xl font-athletic font-semibold text-foreground uppercase tracking-wide">
              Enable Dues Collection
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
              Before enabling payment features, confirm payment handling acknowledgement.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1 accent-primary"
                checked={paymentAckAccepted}
                onChange={(e) => setPaymentAckAccepted(e.target.checked)}
              />
              <span>
                I understand that payments are processed through a third-party provider and that Braik does not directly store full card data.
              </span>
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentAckModal(false)
                  setPaymentAckAccepted(false)
                }}
                className="border-border text-foreground"
              >
                Cancel
              </Button>
              <Button
                disabled={!paymentAckAccepted || loading}
                onClick={async () => {
                  await handleConnect()
                  setShowPaymentAckModal(false)
                  setPaymentAckAccepted(false)
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Confirm and Continue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
