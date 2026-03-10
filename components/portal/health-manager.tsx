"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Stethoscope, Plus, X } from "lucide-react"

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  healthStatus: "active" | "injured" | "unavailable"
}

interface Injury {
  id: string
  player_id: string
  injury_reason: string
  injury_date: string
  expected_return_date: string | null
  actual_return_date: string | null
  status: "active" | "resolved" | "cancelled"
  notes: string | null
  players: {
    id: string
    first_name: string
    last_name: string
    jersey_number: number | null
  }
}

interface HealthManagerProps {
  teamId: string
}

export function HealthManager({ teamId }: HealthManagerProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [injuries, setInjuries] = useState<Injury[]>([])
  const [loading, setLoading] = useState(true)
  const [showInjuryModal, setShowInjuryModal] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("")
  const [injuryReason, setInjuryReason] = useState("")
  const [injuryDate, setInjuryDate] = useState(new Date().toISOString().split("T")[0])
  const [expectedReturnDate, setExpectedReturnDate] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadData()
  }, [teamId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load players
      const playersRes = await fetch(`/api/roster?teamId=${teamId}`)
      if (playersRes.ok) {
        const playersData = await playersRes.json()
        setPlayers(playersData.map((p: any) => ({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          jerseyNumber: p.jerseyNumber,
          healthStatus: p.healthStatus || "active",
        })))
      }

      // Load injuries
      const injuriesRes = await fetch(`/api/health/injuries?teamId=${teamId}`)
      if (injuriesRes.ok) {
        const injuriesData = await injuriesRes.json()
        setInjuries(injuriesData.injuries || [])
      }
    } catch (error) {
      console.error("Failed to load health data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInjury = async () => {
    if (!selectedPlayerId || !injuryReason) {
      alert("Please select a player and provide an injury reason")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/health/injuries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: selectedPlayerId,
          teamId,
          injuryReason,
          injuryDate,
          expectedReturnDate: expectedReturnDate || null,
          notes: notes || null,
        }),
      })

      if (response.ok) {
        alert("Injury recorded successfully!")
        setShowInjuryModal(false)
        resetForm()
        loadData()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to record injury")
      }
    } catch (error) {
      console.error("Failed to create injury:", error)
      alert("Failed to record injury")
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolveInjury = async (injuryId: string) => {
    try {
      const response = await fetch("/api/health/injuries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          injuryId,
          teamId,
          status: "resolved",
          actualReturnDate: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        loadData()
      } else {
        alert("Failed to resolve injury")
      }
    } catch (error) {
      console.error("Failed to resolve injury:", error)
      alert("Failed to resolve injury")
    }
  }

  const resetForm = () => {
    setSelectedPlayerId("")
    setInjuryReason("")
    setInjuryDate(new Date().toISOString().split("T")[0])
    setExpectedReturnDate("")
    setNotes("")
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500"
      case "injured":
        return "bg-red-500"
      case "unavailable":
        return "bg-orange-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active"
      case "injured":
        return "Injured"
      case "unavailable":
        return "Unavailable"
      default:
        return status
    }
  }

  if (loading) {
    return <div className="p-8 text-center">Loading health data...</div>
  }

  const activeInjuries = injuries.filter((i) => i.status === "active")
  const resolvedInjuries = injuries.filter((i) => i.status === "resolved")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Stethoscope className="h-8 w-8" />
            Injury Report
          </h1>
          <p className="text-white/70 mt-1">Track player injuries and health status</p>
        </div>
        <Button onClick={() => setShowInjuryModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Record Injury
        </Button>
      </div>

      {/* Injury Modal */}
      {showInjuryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-[#1e3a5f] border-[#1e3a5f]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Record Injury</CardTitle>
                <button
                  onClick={() => {
                    setShowInjuryModal(false)
                    resetForm()
                  }}
                  className="text-white/70 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="player" className="text-white">Player *</Label>
                <select
                  id="player"
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-md px-3 py-2"
                >
                  <option value="">Select a player</option>
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason" className="text-white">Injury Reason *</Label>
                <Input
                  id="reason"
                  value={injuryReason}
                  onChange={(e) => setInjuryReason(e.target.value)}
                  placeholder="e.g., Sprained ankle, Concussion"
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="injuryDate" className="text-white">Injury Date</Label>
                <Input
                  id="injuryDate"
                  type="date"
                  value={injuryDate}
                  onChange={(e) => setInjuryDate(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="returnDate" className="text-white">Expected Return Date</Label>
                <Input
                  id="returnDate"
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className="bg-white/10 border-white/20 text-white"
                />
                <p className="text-xs text-white/60">
                  This will create a calendar event for the expected return date
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-white">Notes (Optional)</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional details about the injury"
                  className="w-full bg-white/10 border border-white/20 text-white rounded-md px-3 py-2 min-h-[80px]"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreateInjury} disabled={submitting} className="flex-1">
                  {submitting ? "Recording..." : "Record Injury"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInjuryModal(false)
                    resetForm()
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Injuries */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Active Injuries</CardTitle>
          <CardDescription className="text-white/70">
            Currently injured players
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeInjuries.length === 0 ? (
            <p className="text-white/70">No active injuries</p>
          ) : (
            <div className="space-y-4">
              {activeInjuries.map((injury) => {
                const player = injury.players
                return (
                  <div
                    key={injury.id}
                    className="bg-white/5 rounded-lg p-4 border border-white/10"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-red-500 font-bold">●</span>
                          <h3 className="text-white font-semibold">
                            {player.jersey_number ? `#${player.jersey_number} ` : ""}
                            {player.first_name} {player.last_name}
                          </h3>
                        </div>
                        <p className="text-white/90 mb-1">
                          <strong>Injury:</strong> {injury.injury_reason}
                        </p>
                        <p className="text-white/70 text-sm">
                          <strong>Date:</strong> {new Date(injury.injury_date).toLocaleDateString()}
                        </p>
                        {injury.expected_return_date && (
                          <p className="text-white/70 text-sm">
                            <strong>Expected Return:</strong>{" "}
                            {new Date(injury.expected_return_date).toLocaleDateString()}
                          </p>
                        )}
                        {injury.notes && (
                          <p className="text-white/70 text-sm mt-2">{injury.notes}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolveInjury(injury.id)}
                      >
                        Mark Resolved
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player Health Status Summary */}
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Player Health Status</CardTitle>
          <CardDescription className="text-white/70">
            Overview of all player health statuses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map((player) => {
              const playerInjury = activeInjuries.find((i) => i.player_id === player.id)
              return (
                <div
                  key={player.id}
                  className="bg-white/5 rounded-lg p-3 border border-white/10"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-3 h-3 rounded-full ${getStatusColor(player.healthStatus)}`}
                    />
                    <span className="text-white font-medium">
                      {player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}
                      {player.firstName} {player.lastName}
                    </span>
                  </div>
                  <p className="text-white/70 text-sm">
                    Status: {getStatusLabel(player.healthStatus)}
                  </p>
                  {playerInjury && (
                    <p className="text-red-400 text-sm mt-1">
                      {playerInjury.injury_reason}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Resolved Injuries */}
      {resolvedInjuries.length > 0 && (
        <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
          <CardHeader>
            <CardTitle className="text-white">Resolved Injuries</CardTitle>
            <CardDescription className="text-white/70">
              Recently resolved injuries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resolvedInjuries.slice(0, 10).map((injury) => {
                const player = injury.players
                return (
                  <div
                    key={injury.id}
                    className="bg-white/5 rounded-lg p-3 border border-white/10"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span className="text-white/90">
                        {player.jersey_number ? `#${player.jersey_number} ` : ""}
                        {player.first_name} {player.last_name}
                      </span>
                      <span className="text-white/70 text-sm">
                        - {injury.injury_reason} (Resolved{" "}
                        {injury.actual_return_date
                          ? new Date(injury.actual_return_date).toLocaleDateString()
                          : "recently"}
                        )
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
