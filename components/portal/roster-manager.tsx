"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface Player {
  id: string
  firstName: string
  lastName: string
  grade: number | null
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  notes: string | null
  user: { email: string } | null
  guardianLinks: Array<{
    guardian: { user: { email: string } }
  }>
}

export function RosterManager({ teamId, players: initialPlayers, canEdit }: { teamId: string; players: Player[]; canEdit: boolean }) {
  const [players, setPlayers] = useState(initialPlayers)
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [grade, setGrade] = useState("")
  const [jerseyNumber, setJerseyNumber] = useState("")
  const [positionGroup, setPositionGroup] = useState("")
  const [email, setEmail] = useState("")
  const [notes, setNotes] = useState("")
  const [showImportForm, setShowImportForm] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)

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

  return (
    <div>
      {canEdit && (
        <div className="mb-6 flex gap-4">
          {!showAddForm && !showImportForm && (
            <>
              <Button onClick={() => setShowAddForm(true)}>Add Player</Button>
              <Button variant="outline" onClick={() => setShowImportForm(true)}>Import CSV</Button>
            </>
          )}
        </div>
      )}

      {showImportForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Import Players from CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted">
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

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Player</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Grade</Label>
                <Input type="number" value={grade} onChange={(e) => setGrade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Jersey Number</Label>
                <Input type="number" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
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
                <Label>Email (optional - for invite)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Notes</Label>
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

      <div className="grid gap-4">
        {players.map((player) => (
          <Card key={player.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">
                    {player.firstName} {player.lastName}
                  </h3>
                  <div className="text-sm mt-1 text-[var(--team-secondary)]">
                    {player.jerseyNumber && `#${player.jerseyNumber} • `}
                    {player.positionGroup && `${player.positionGroup} • `}
                    {player.grade && `Grade ${player.grade}`}
                  </div>
                  {player.notes && (
                    <div className="text-xs text-muted mt-1 italic">{player.notes}</div>
                  )}
                  {player.user && (
                    <div className="text-xs text-[#FFFFFF] mt-1">Account: {player.user.email}</div>
                  )}
                  {player.guardianLinks.length > 0 && (
                    <div className="text-xs text-[#FFFFFF] mt-1">
                      Guardians: {player.guardianLinks.map((link) => link.guardian.user.email).join(", ")}
                    </div>
                  )}
                </div>
                <div className="text-sm">
                  <span
                    className={`px-3 py-1 rounded-full font-semibold uppercase tracking-wide ${
                      player.status === "active" ? "bg-green-600 text-white" : "bg-red-600 text-white"
                    }`}
                  >
                    {player.status}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

