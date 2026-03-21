"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { startOfDay } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { DatePicker, dateToYmd } from "@/components/portal/date-time-picker"
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
  severity: string | null
  exempt_from_practice: boolean
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
  const [injuryDate, setInjuryDate] = useState<Date>(() => startOfDay(new Date()))
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | null>(null)
  const [notes, setNotes] = useState("")
  const [severity, setSeverity] = useState<string>("")
  const [exemptFromPractice, setExemptFromPractice] = useState(false)
  const [playerPickQuery, setPlayerPickQuery] = useState("")
  const [detailInjury, setDetailInjury] = useState<Injury | null>(null)
  const [detailSeverity, setDetailSeverity] = useState("")
  const [detailExempt, setDetailExempt] = useState(false)
  const [detailSaving, setDetailSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const filteredPlayersForPick = useMemo(() => {
    const q = playerPickQuery.trim().toLowerCase()
    if (!q) return players
    return players.filter((p) => {
      const name = `${p.firstName} ${p.lastName}`.toLowerCase()
      const num = p.jerseyNumber != null ? String(p.jerseyNumber) : ""
      return name.includes(q) || num.includes(q)
    })
  }, [players, playerPickQuery])

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
        const raw = injuriesData.injuries || []
        setInjuries(
          raw.map((i: Injury) => ({
            ...i,
            severity: i.severity ?? null,
            exempt_from_practice: i.exempt_from_practice === true,
          }))
        )
      }
    } catch (error) {
      console.error("Failed to load health data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInjury = async () => {
    if (!selectedPlayerId || !injuryReason.trim()) {
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
          injuryReason: injuryReason.trim(),
          injuryDate: dateToYmd(injuryDate),
          expectedReturnDate: expectedReturnDate ? dateToYmd(expectedReturnDate) : null,
          notes: notes || null,
          severity: severity.trim() || null,
          exemptFromPractice,
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
    setPlayerPickQuery("")
    setInjuryReason("")
    setInjuryDate(startOfDay(new Date()))
    setExpectedReturnDate(null)
    setNotes("")
    setSeverity("")
    setExemptFromPractice(false)
  }

  useEffect(() => {
    if (!detailInjury) return
    setDetailSeverity(detailInjury.severity || "")
    setDetailExempt(detailInjury.exempt_from_practice === true)
  }, [detailInjury])

  const saveDetailInjury = async () => {
    if (!detailInjury) return
    setDetailSaving(true)
    try {
      const response = await fetch("/api/health/injuries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          injuryId: detailInjury.id,
          teamId,
          severity: detailSeverity.trim() || null,
          exemptFromPractice: detailExempt,
        }),
      })
      if (response.ok) {
        await loadData()
        setDetailInjury(null)
      } else {
        let msg = "Failed to save injury details."
        try {
          const errBody = await response.json()
          if (errBody?.error && typeof errBody.error === "string") msg = errBody.error
        } catch {
          /* ignore */
        }
        alert(msg)
      }
    } finally {
      setDetailSaving(false)
    }
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
          <h1 className="text-3xl font-bold flex items-center gap-2" style={{ color: "rgb(var(--text))" }}>
            <Stethoscope className="h-8 w-8" />
            Injury Report
          </h1>
          <p className="mt-1" style={{ color: "rgb(var(--muted))" }}>Track player injuries and health status</p>
        </div>
        <Button 
          onClick={() => setShowInjuryModal(true)}
          style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Record Injury
        </Button>
      </div>

      {/* Injury Modal */}
      {showInjuryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle style={{ color: "rgb(var(--text))" }}>Record Injury</CardTitle>
                <button
                  onClick={() => {
                    setShowInjuryModal(false)
                    resetForm()
                  }}
                  style={{ color: "rgb(var(--muted))" }}
                  className="hover:opacity-70"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playerSearch" style={{ color: "rgb(var(--text))" }}>Find player *</Label>
                <Input
                  id="playerSearch"
                  value={playerPickQuery}
                  onChange={(e) => setPlayerPickQuery(e.target.value)}
                  placeholder="Type name or jersey #"
                  className="border"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
                <Label htmlFor="player" className="sr-only">
                  Player
                </Label>
                <select
                  id="player"
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="w-full rounded-md px-3 py-2 border"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                >
                  <option value="">Select a player</option>
                  {filteredPlayersForPick.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.jerseyNumber ? `#${p.jerseyNumber} ` : ""}
                      {p.firstName} {p.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason" style={{ color: "rgb(var(--text))" }}>Injury Reason *</Label>
                <Input
                  id="reason"
                  value={injuryReason}
                  onChange={(e) => setInjuryReason(e.target.value)}
                  placeholder="e.g., Sprained ankle, Concussion"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
              </div>

              <DatePicker
                id="injuryDate"
                label="Injury Date"
                value={injuryDate}
                onChange={(d) => d && setInjuryDate(d)}
                placeholder="Select injury date"
                maxDate={new Date()}
              />

              <div className="space-y-2">
                <DatePicker
                  id="returnDate"
                  label="Expected Return Date"
                  value={expectedReturnDate}
                  onChange={setExpectedReturnDate}
                  placeholder="Optional"
                  minDate={injuryDate}
                  allowClear
                />
                <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                  This will create a calendar event for the expected return date
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" style={{ color: "rgb(var(--text))" }}>Notes (Optional)</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional details about the injury"
                  className="w-full rounded-md px-3 py-2 min-h-[80px] border"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="severity" style={{ color: "rgb(var(--text))" }}>Severity</Label>
                <select
                  id="severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full rounded-md px-3 py-2 border"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                >
                  <option value="">Not specified</option>
                  <option value="day_to_day">Day-to-day</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm" style={{ color: "rgb(var(--text))" }}>
                <input
                  type="checkbox"
                  checked={exemptFromPractice}
                  onChange={(e) => setExemptFromPractice(e.target.checked)}
                  className="h-4 w-4 rounded border"
                />
                Exempt from practice
              </label>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleCreateInjury} 
                  disabled={submitting} 
                  className="flex-1"
                  style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                >
                  {submitting ? "Recording..." : "Record Injury"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInjuryModal(false)
                    resetForm()
                  }}
                  style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Injuries */}
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            ACTIVE INJURIES
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
            Currently injured players
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeInjuries.length === 0 ? (
            <div
              className="rounded-lg border border-dashed px-4 py-8 text-center"
              style={{ borderColor: "rgb(var(--border))", backgroundColor: "rgb(var(--platinum))" }}
            >
              <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
                No active injuries
              </p>
              <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
                When you record an injury, it appears here. Add players from the roster first if this list is empty.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeInjuries.map((injury) => {
                const player = injury.players
                return (
                  <button
                    type="button"
                    key={injury.id}
                    onClick={() => setDetailInjury(injury)}
                    className="rounded-lg p-4 border text-left min-h-[152px] flex flex-col transition-opacity hover:opacity-95"
                    style={{ backgroundColor: "rgb(var(--platinum))", borderColor: "rgb(var(--border))" }}
                  >
                    <div className="flex items-start justify-between gap-2 flex-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-red-500 font-bold shrink-0">●</span>
                          <h3 className="font-semibold truncate" style={{ color: "rgb(var(--text))" }}>
                            {player.jersey_number ? `#${player.jersey_number} ` : ""}
                            {player.first_name} {player.last_name}
                          </h3>
                        </div>
                        <p className="mb-1 line-clamp-2" style={{ color: "rgb(var(--text))" }}>
                          <strong>Injury:</strong> {injury.injury_reason}
                        </p>
                        <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                          <strong>Date:</strong> {new Date(injury.injury_date).toLocaleDateString()}
                        </p>
                        {injury.severity && (
                          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                            <strong>Severity:</strong> {injury.severity.replace(/_/g, " ")}
                          </p>
                        )}
                        {injury.exempt_from_practice && (
                          <p className="text-sm text-amber-700 font-medium">Practice exempt</p>
                        )}
                        {injury.expected_return_date && (
                          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                            <strong>Expected return:</strong>{" "}
                            {new Date(injury.expected_return_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs mt-2" style={{ color: "rgb(var(--accent))" }}>
                      Tap for details
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Player Health Status Summary */}
      <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
        <CardHeader>
          <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
            PLAYER HEALTH STATUS
          </CardTitle>
          <CardDescription style={{ color: "rgb(var(--muted))" }}>
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
                  className="rounded-lg p-3 border"
                  style={{ backgroundColor: "rgb(var(--platinum))", borderColor: "rgb(var(--border))" }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`w-3 h-3 rounded-full ${getStatusColor(player.healthStatus)}`}
                    />
                    <span className="font-medium" style={{ color: "rgb(var(--text))" }}>
                      {player.jerseyNumber ? `#${player.jerseyNumber} ` : ""}
                      {player.firstName} {player.lastName}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                    Status: {getStatusLabel(player.healthStatus)}
                  </p>
                  {playerInjury && (
                    <p className="text-red-600 text-sm mt-1">
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
        <Card className="border" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
          <CardHeader>
            <CardTitle className="uppercase text-xs font-bold tracking-wide" style={{ color: "rgb(var(--muted))" }}>
              RESOLVED INJURIES
            </CardTitle>
            <CardDescription style={{ color: "rgb(var(--muted))" }}>
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
                    className="rounded-lg p-3 border"
                    style={{ backgroundColor: "rgb(var(--platinum))", borderColor: "rgb(var(--border))" }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span style={{ color: "rgb(var(--text))" }}>
                        {player.jersey_number ? `#${player.jersey_number} ` : ""}
                        {player.first_name} {player.last_name}
                      </span>
                      <span className="text-sm" style={{ color: "rgb(var(--muted))" }}>
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

      {detailInjury && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg border max-h-[90vh] overflow-y-auto" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--accent))" }}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle style={{ color: "rgb(var(--text))" }}>Injury details</CardTitle>
                <button
                  type="button"
                  onClick={() => setDetailInjury(null)}
                  className="hover:opacity-70"
                  style={{ color: "rgb(var(--muted))" }}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <CardDescription style={{ color: "rgb(var(--muted))" }}>
                {detailInjury.players.jersey_number ? `#${detailInjury.players.jersey_number} ` : ""}
                {detailInjury.players.first_name} {detailInjury.players.last_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p style={{ color: "rgb(var(--text))" }}>
                <strong>Reason:</strong> {detailInjury.injury_reason}
              </p>
              <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                <strong>Date injured:</strong> {new Date(detailInjury.injury_date).toLocaleDateString()}
              </p>
              {detailInjury.expected_return_date && (
                <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                  <strong>Expected return:</strong>{" "}
                  {new Date(detailInjury.expected_return_date).toLocaleDateString()}
                </p>
              )}
              {detailInjury.notes && (
                <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
                  <strong>Notes:</strong> {detailInjury.notes}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="detailSeverity" style={{ color: "rgb(var(--text))" }}>Severity</Label>
                <select
                  id="detailSeverity"
                  value={detailSeverity}
                  onChange={(e) => setDetailSeverity(e.target.value)}
                  className="w-full rounded-md px-3 py-2 border"
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderColor: "rgb(var(--border))",
                    color: "rgb(var(--text))",
                  }}
                >
                  <option value="">Not specified</option>
                  <option value="day_to_day">Day-to-day</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm" style={{ color: "rgb(var(--text))" }}>
                <input
                  type="checkbox"
                  checked={detailExempt}
                  onChange={(e) => setDetailExempt(e.target.checked)}
                  className="h-4 w-4 rounded border"
                />
                Exempt from practice
              </label>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  onClick={saveDetailInjury}
                  disabled={detailSaving}
                  className="flex-1"
                  style={{ backgroundColor: "rgb(var(--accent))", color: "white" }}
                >
                  {detailSaving ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    handleResolveInjury(detailInjury.id)
                    setDetailInjury(null)
                  }}
                  style={{ borderColor: "rgb(var(--border))", color: "rgb(var(--text))" }}
                >
                  Mark resolved
                </Button>
                <Button variant="outline" asChild className="flex-1 border-border">
                  <Link href={`/dashboard/roster/${detailInjury.player_id}?teamId=${encodeURIComponent(teamId)}`}>
                    Player profile
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
