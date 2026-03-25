"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ArrowUpDown } from "lucide-react"

interface TeamOption {
  id: string
  name: string
  teamLevel: string | null
}

interface PlayerPromoteModalProps {
  open: boolean
  onClose: () => void
  programId: string
  playerId: string
  playerName: string
  currentTeamId: string
  onSuccess: () => void
}

export function PlayerPromoteModal({
  open,
  onClose,
  programId,
  playerId,
  playerName,
  currentTeamId,
  onSuccess,
}: PlayerPromoteModalProps) {
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [toTeamId, setToTeamId] = useState("")
  const [reason, setReason] = useState("")
  const [season, setSeason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !programId) return
    setLoadingTeams(true)
    setError(null)
    fetch(`/api/programs/${programId}/teams`)
      .then((res) => (res.ok ? res.json() : { teams: [] }))
      .then((data: { teams?: TeamOption[] }) => {
        const list = data.teams ?? []
        setTeams(list.filter((t) => t.id !== currentTeamId))
        setToTeamId(list.find((t) => t.id !== currentTeamId)?.id ?? "")
      })
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false))
  }, [open, programId, currentTeamId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!toTeamId) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/players/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId,
          toTeamId,
          promotionReason: reason.trim() || null,
          season: season.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Failed to move player")
        return
      }
      onSuccess()
      onClose()
      setReason("")
      setSeason("")
    } catch {
      setError("Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Move player
          </DialogTitle>
          <DialogDescription>
            Move <strong>{playerName}</strong> to another football squad in this program (varsity, JV, or freshman).
            Their player record and parent links stay the same; linked accounts and gear assignments move with them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="toTeam">Destination team</Label>
            <select
              id="toTeam"
              value={toTeamId}
              onChange={(e) => setToTeamId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={loadingTeams}
            >
              <option value="">Select team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.teamLevel ? `${t.teamLevel.charAt(0).toUpperCase() + t.teamLevel.slice(1)} — ${t.name}` : t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <input
              id="reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Call-up, performance"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="season">Season (optional)</Label>
            <input
              id="season"
              type="text"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="e.g. 2025"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!toTeamId || submitting}>
              {submitting ? "Moving…" : "Move player"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
