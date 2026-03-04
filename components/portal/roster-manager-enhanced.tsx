"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RosterGridView } from "./roster-grid-view"
import { DepthChartView } from "./depth-chart-view"

interface Player {
  id: string
  firstName: string
  lastName: string
  grade: number | null
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  notes: string | null
  imageUrl?: string | null
  user: { email: string } | null
  guardianLinks: Array<{
    guardian: { user: { email: string } }
  }>
}

interface DepthChartEntry {
  id: string
  unit: string
  position: string
  string: number
  playerId: string | null
  player?: Player | null
  formation?: string | null
  specialTeamType?: string | null
}

interface RosterManagerEnhancedProps {
  teamId: string
  players: Player[]
  canEdit: boolean
  teamSport: string
  userRole?: string
}

export function RosterManagerEnhanced({ 
  teamId, 
  players: initialPlayers, 
  canEdit,
  teamSport,
  userRole
}: RosterManagerEnhancedProps) {
  const [players, setPlayers] = useState(initialPlayers)
  const [activeTab, setActiveTab] = useState<"roster" | "depth-chart">("roster")
  const [depthChart, setDepthChart] = useState<DepthChartEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showImportForm, setShowImportForm] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [grade, setGrade] = useState("")
  const [jerseyNumber, setJerseyNumber] = useState("")
  const [positionGroup, setPositionGroup] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)

  const isFootball = teamSport?.toLowerCase() === "football"

  // Load depth chart data
  useEffect(() => {
    if (isFootball && activeTab === "depth-chart") {
      loadDepthChart()
    }
  }, [teamId, isFootball, activeTab])

  const loadDepthChart = async () => {
    try {
      const response = await fetch(`/api/roster/depth-chart?teamId=${teamId}`)
      if (response.ok) {
        const data = await response.json()
        setDepthChart(data.entries || [])
      }
    } catch (error) {
      console.error("Failed to load depth chart:", error)
    }
  }

  const handleAddPlayer = async () => {
    if (!firstName || !lastName) {
      alert("First and last name are required")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          firstName,
          lastName,
          grade: grade ? parseInt(grade) : null,
          jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : null,
          positionGroup: positionGroup || null,
          email: email || null,
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to add player")
      }

      const newPlayer = await response.json()
      setPlayers([...players, newPlayer])
      setFirstName("")
      setLastName("")
      setGrade("")
      setJerseyNumber("")
      setPositionGroup("")
      setEmail("")
      setNotes("")
      setShowAddForm(false)
    } catch (error) {
      alert("Error adding player")
    } finally {
      setLoading(false)
    }
  }

  const handleCsvImport = async () => {
    if (!csvFile) {
      alert("Please select a CSV file")
      return
    }

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", csvFile)
      formData.append("teamId", teamId)

      const response = await fetch("/api/roster/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to import CSV")
      }

      const result = await response.json()
      setPlayers([...players, ...result.players])
      setCsvFile(null)
      setShowImportForm(false)
      alert(`Successfully imported ${result.players.length} players`)
    } catch (error: any) {
      alert(error.message || "Error importing CSV")
    } finally {
      setLoading(false)
    }
  }

  const handleDepthChartUpdate = async (updates: Array<{
    unit: string
    position: string
    string: number
    playerId: string | null
    formation?: string | null
    specialTeamType?: string | null
  }>) => {
    try {
      const response = await fetch("/api/roster/depth-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          entries: updates,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.error || "Failed to update depth chart")
      }

      await loadDepthChart()
    } catch (error: any) {
      console.error("Failed to update depth chart:", error)
      alert(`Error updating depth chart: ${error.message || "Unknown error"}`)
    }
  }

  return (
    <div>
      {/* Tab Navigation */}
      <div className="mb-6 border-b border-[#64748B]">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("roster")}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === "roster"
                ? "border-b-2"
                : "opacity-60 hover:opacity-100"
            }`}
            style={activeTab === "roster" ? { borderBottomColor: "#3B82F6", color: "#000000" } : { color: "#000000" }}
          >
            Roster View
          </button>
          {isFootball && (
            <button
              onClick={() => setActiveTab("depth-chart")}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === "depth-chart"
                  ? "border-b-2"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={activeTab === "depth-chart" ? { borderBottomColor: "#3B82F6", color: "#000000" } : { color: "#000000" }}
            >
              Depth Chart
            </button>
          )}
        </div>
      </div>

      {/* Add/Import Controls */}
      {canEdit && activeTab === "roster" && (
        <div className="mb-6 flex gap-4">
          {!showAddForm && !showImportForm && (
            <>
              <Button onClick={() => setShowAddForm(true)}>Add Player</Button>
              <Button variant="outline" onClick={() => setShowImportForm(true)}>Import CSV</Button>
            </>
          )}
        </div>
      )}

      {/* Import Form */}
      {showImportForm && (
        <Card className="mb-6 bg-white border border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0F172A]">Import Players from CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[#111827]">CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="text-[#111827]"
                />
                <p className="text-xs text-[#6B7280]">
                  CSV format: First Name, Last Name, Grade, Jersey Number, Position, Email (optional), Notes (optional)
                </p>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <Button onClick={handleCsvImport} disabled={loading || !csvFile}>
                {loading ? "Importing..." : "Import CSV"}
              </Button>
              <Button variant="outline" onClick={() => setShowImportForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Player Form */}
      {showAddForm && (
        <Card className="mb-6 bg-white border border-[#E5E7EB]">
          <CardHeader>
            <CardTitle className="text-[#0F172A]">Add Player</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#0F172A]">First Name *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Last Name *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Grade</Label>
                <Input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Jersey Number</Label>
                <Input type="number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Position</Label>
                <select
                  value={positionGroup}
                  onChange={(e) => setPositionGroup(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                >
                  <option value="">Select position</option>
                  <option value="QB">QB</option>
                  <option value="RB">RB</option>
                  <option value="WR">WR</option>
                  <option value="TE">TE</option>
                  <option value="OL">OL</option>
                  <option value="DL">DL</option>
                  <option value="LB">LB</option>
                  <option value="DB">DB</option>
                  <option value="K">K</option>
                  <option value="P">P</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[#0F172A]">Email (optional - for invite)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label className="text-[#0F172A]">Notes</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex min-h-[80px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                  placeholder="Eligibility notes, injuries, etc."
                />
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <Button onClick={handleAddPlayer} disabled={loading}>
                {loading ? "Adding..." : "Add Player"}
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Views */}
      {activeTab === "roster" && (
        <RosterGridView
          players={players}
          canEdit={canEdit}
        />
      )}

      {activeTab === "depth-chart" && isFootball && (
        <DepthChartView
          teamId={teamId}
          players={players}
          depthChart={depthChart}
          onUpdate={handleDepthChartUpdate}
          canEdit={canEdit}
          isHeadCoach={userRole === "HEAD_COACH"}
        />
      )}
    </div>
  )
}
