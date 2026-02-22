"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react"

interface ActionProposal {
  id: string
  actionType: string
  payload: any
  preview: {
    summary: string
    items: any[]
    affectedCount: number
  }
  status: string
  createdAt: string
  createdBy: {
    name: string | null
    email: string
  }
}

interface AIActionConfirmationProps {
  proposalId: string
  teamId: string
  onConfirmed?: () => void
  onRejected?: () => void
}

export function AIActionConfirmation({
  proposalId,
  teamId,
  onConfirmed,
  onRejected,
}: AIActionConfirmationProps) {
  const [proposal, setProposal] = useState<ActionProposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProposal()
  }, [proposalId])

  const loadProposal = async () => {
    try {
      const response = await fetch(`/api/ai/confirm-action?proposalId=${proposalId}`)
      if (!response.ok) {
        throw new Error("Failed to load proposal")
      }
      const data = await response.json()
      setProposal(data.proposal)
    } catch (err: any) {
      setError(err.message || "Failed to load proposal")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!proposal) return

    setConfirming(true)
    setError(null)

    try {
      const response = await fetch("/api/ai/confirm-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to confirm action")
      }

      const data = await response.json()
      if (data.success) {
        onConfirmed?.()
      } else {
        throw new Error(data.message || "Action confirmation failed")
      }
    } catch (err: any) {
      setError(err.message || "Failed to confirm action")
    } finally {
      setConfirming(false)
    }
  }

  const handleReject = async () => {
    // In production, would update proposal status to "rejected"
    onRejected?.()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2 text-text">Loading proposal...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !proposal) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center text-danger">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!proposal) {
    return null
  }

  const getActionTypeLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      create_parent_announcement: "Create Parent Announcement",
      modify_roster: "Modify Roster",
      add_player: "Add Player",
      remove_player: "Remove Player",
      update_player: "Update Player",
      bulk_create_events: "Bulk Create Events",
      modify_depth_chart: "Modify Depth Chart",
    }
    return labels[actionType] || actionType
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Action Requires Approval
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Proposal Info */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">Action Type</span>
            <span className="text-sm text-text-2">{getActionTypeLabel(proposal.actionType)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">Proposed By</span>
            <span className="text-sm text-text-2">
              {proposal.createdBy.name || proposal.createdBy.email}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">Created</span>
            <span className="text-sm text-text-2">
              {new Date(proposal.createdAt).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Preview */}
        {proposal.preview && (
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-text mb-2">Preview</h4>
            <p className="text-sm text-text-2 mb-3">{proposal.preview.summary}</p>
            {proposal.preview.affectedCount > 0 && (
              <p className="text-xs text-text-2">
                This will affect {proposal.preview.affectedCount} item(s)
              </p>
            )}
            {proposal.preview.items && proposal.preview.items.length > 0 && (
              <div className="mt-3 space-y-2">
                {proposal.preview.items.slice(0, 5).map((item: any, idx: number) => (
                  <div key={idx} className="text-xs bg-surface-2 p-2 rounded">
                    {item.title || item.name || JSON.stringify(item)}
                  </div>
                ))}
                {proposal.preview.items.length > 5 && (
                  <p className="text-xs text-text-2">
                    ...and {proposal.preview.items.length - 5} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded p-3">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button
            onClick={handleConfirm}
            disabled={confirming || proposal.status !== "pending"}
            className="flex-1 bg-primary text-text hover:bg-primary/90"
          >
            {confirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm & Execute
              </>
            )}
          </Button>
          <Button
            onClick={handleReject}
            disabled={confirming}
            variant="outline"
            className="flex-1"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
        </div>

        {/* Warning */}
        <div className="bg-warning/10 border border-warning/20 rounded p-3">
          <p className="text-xs text-text-2">
            <strong>Note:</strong> This action will be executed immediately upon confirmation. Only
            Head Coach can approve this action.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
