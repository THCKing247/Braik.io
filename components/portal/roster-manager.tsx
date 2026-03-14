"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

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
  const [importMode, setImportMode] = useState<"create_only" | "create_or_update" | "replace_roster">("create_only")
  const [lastImportResult, setLastImportResult] = useState<{
    summary: { totalRows: number; created: number; updated?: number; replaced?: number; skipped: number; conflicts: number }
    conflicts: Array<{ row: number; reason: string }>
    skippedRows: Array<{ row: number; reason: string }>
    parseErrors?: Array<{ row: number; message: string }>
  } | null>(null)
  const [showReplaceConfirmModal, setShowReplaceConfirmModal] = useState(false)

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

  const runCsvImport = async () => {
    if (!csvFile) return

    setLoading(true)
    setLastImportResult(null)
    try {
      const formData = new FormData()
      formData.append("file", csvFile)
      formData.append("teamId", teamId)
      formData.append("importMode", importMode)

      const response = await fetch("/api/roster/import", {
        method: "POST",
        body: formData,
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Failed to import CSV")
      }

      if (data.summary) {
        setLastImportResult({
          summary: data.summary,
          conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
          skippedRows: Array.isArray(data.skippedRows) ? data.skippedRows : [],
          parseErrors: Array.isArray(data.parseErrors) ? data.parseErrors : undefined,
        })
      }

      if (importMode === "replace_roster" || importMode === "create_or_update") {
        const rosterRes = await fetch(`/api/roster?teamId=${encodeURIComponent(teamId)}`)
        if (rosterRes.ok) {
          const rosterData = await rosterRes.json()
          setPlayers(Array.isArray(rosterData) ? rosterData : [])
        } else {
          setPlayers([...players, ...(Array.isArray(data.players) ? data.players : [])])
        }
      } else {
        setPlayers([...players, ...(Array.isArray(data.players) ? data.players : [])])
      }
      setCsvFile(null)
      setShowImportForm(false)
      setShowReplaceConfirmModal(false)
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : "Error importing CSV")
    } finally {
      setLoading(false)
    }
  }

  const handleCsvImport = () => {
    if (!csvFile) {
      alert("Please select a CSV file")
      return
    }
    if (importMode === "replace_roster") {
      setShowReplaceConfirmModal(true)
      return
    }
    void runCsvImport()
  }

  const handleConfirmReplaceRoster = () => {
    setShowReplaceConfirmModal(false)
    void runCsvImport()
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
                <Label>Import mode</Label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as "create_only" | "create_or_update" | "replace_roster")}
                  className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm ${
                    importMode === "replace_roster"
                      ? "border-red-300 bg-red-50/50 focus-visible:ring-red-500"
                      : "border-border bg-bg"
                  }`}
                >
                  <option value="create_only">Create only</option>
                  <option value="create_or_update">Create or update</option>
                  <option value="replace_roster">Replace roster</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  {importMode === "create_only" && "Adds new players only; existing players are left unchanged."}
                  {importMode === "create_or_update" && "Updates matched players and creates new ones; no rows are deleted."}
                  {importMode === "replace_roster" && (
                    <span className="text-red-700 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Removes the current roster and related player-linked records, then imports from CSV. This cannot be undone.
                    </span>
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <Label>CSV File</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted">
                  CSV format: First Name, Last Name, Grade, Jersey Number, Position, Email (optional), Notes (optional), Weight (optional), Height (optional)
                </p>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <Button onClick={handleCsvImport} disabled={loading || !csvFile}>
                {loading ? "Importing..." : "Import CSV"}
              </Button>
              <Button variant="outline" onClick={() => setShowImportForm(false)} disabled={loading}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showReplaceConfirmModal} onOpenChange={setShowReplaceConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Replace entire roster?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              This action will remove the current team roster and all related player-linked records (e.g. assignments, follow-ups) before importing the new CSV. This cannot be undone. Do you want to continue?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setShowReplaceConfirmModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmReplaceRoster} disabled={loading}>
              {loading ? "Importing..." : "Confirm & replace roster"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {lastImportResult && !showImportForm && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Import complete</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setLastImportResult(null)} aria-label="Dismiss">
                ×
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <section>
              <h4 className="font-semibold mb-1">Summary</h4>
              <p>
                {lastImportResult.summary.totalRows != null && `${lastImportResult.summary.totalRows} rows processed. `}
                {lastImportResult.summary.created} created
                {lastImportResult.summary.updated != null && lastImportResult.summary.updated > 0 && `, ${lastImportResult.summary.updated} updated`}
                {lastImportResult.summary.replaced != null && lastImportResult.summary.replaced > 0 && `, ${lastImportResult.summary.replaced} replaced`}
                {lastImportResult.summary.skipped > 0 && `, ${lastImportResult.summary.skipped} skipped`}
                {lastImportResult.summary.conflicts > 0 && `, ${lastImportResult.summary.conflicts} conflicts`}.
              </p>
            </section>
            {lastImportResult.parseErrors && lastImportResult.parseErrors.length > 0 && (
              <section className="rounded bg-amber-50 border border-amber-200 p-3 text-amber-900">
                <h4 className="font-semibold mb-1">CSV parsing issues</h4>
                <ul className="list-disc list-inside space-y-0.5">
                  {lastImportResult.parseErrors.slice(0, 15).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                  {lastImportResult.parseErrors.length > 15 && (
                    <li>… and {lastImportResult.parseErrors.length - 15} more</li>
                  )}
                </ul>
              </section>
            )}
            {lastImportResult.conflicts.length > 0 && (
              <section className="rounded bg-amber-50 border border-amber-200 p-3 text-amber-900">
                <h4 className="font-semibold mb-1">Conflicts (row not applied)</h4>
                <ul className="list-disc list-inside space-y-0.5">
                  {lastImportResult.conflicts.slice(0, 10).map((c, i) => (
                    <li key={i}>Row {c.row}: {c.reason}</li>
                  ))}
                  {lastImportResult.conflicts.length > 10 && (
                    <li>… and {lastImportResult.conflicts.length - 10} more</li>
                  )}
                </ul>
              </section>
            )}
            {lastImportResult.skippedRows.length > 0 && (
              <section className="rounded bg-amber-50 border border-amber-200 p-3 text-amber-900">
                <h4 className="font-semibold mb-1">Skipped rows</h4>
                <ul className="list-disc list-inside space-y-0.5">
                  {lastImportResult.skippedRows.slice(0, 10).map((s, i) => (
                    <li key={i}>Row {s.row}: {s.reason}</li>
                  ))}
                  {lastImportResult.skippedRows.length > 10 && (
                    <li>… and {lastImportResult.skippedRows.length - 10} more</li>
                  )}
                </ul>
              </section>
            )}
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

