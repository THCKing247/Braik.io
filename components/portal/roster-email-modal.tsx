"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Mail, Send, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePlaybookToast } from "@/components/portal/playbook-toast"

interface RosterEmailModalProps {
  teamId: string
  onClose: () => void
}

type RosterRow = {
  id: string
  jerseyNumber: number | null
  name: string
  grade: number | null
  gradeLabel: string | null
  position: string | null
  weight: number | null
  height: string | null
}

type RosterData = {
  team: { name: string; schoolName: string | null; year: number }
  template: {
    header: { showYear: boolean; showSchoolName: boolean; showTeamName: boolean; yearLabel: string; schoolNameLabel: string; teamNameLabel: string }
    body: {
      showJerseyNumber: boolean
      showPlayerName: boolean
      showGrade: boolean
      showPosition?: boolean
      showWeight?: boolean
      showHeight?: boolean
      jerseyNumberLabel: string
      playerNameLabel: string
      gradeLabel: string
      positionLabel?: string
      weightLabel?: string
      heightLabel?: string
    }
    footer: { showGeneratedDate: boolean; customText: string }
  }
  players: RosterRow[]
  generatedAt: string
}

export function RosterEmailModal({ teamId, onClose }: RosterEmailModalProps) {
  const { showToast } = usePlaybookToast()
  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [recipientEmail, setRecipientEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showPreview, setShowPreview] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/roster/print?teamId=${teamId}`)
        if (res.ok) {
          const data = await res.json()
          setRosterData(data)
          const ids = (data.players || []).map((p: RosterRow) => p.id)
          setSelectedIds(new Set(ids))
          setSubject(`Roster — ${data.team?.name ?? "Team"} — ${new Date().toLocaleDateString()}`)
        } else {
          showToast("Could not load roster", "error")
        }
      } catch {
        showToast("Could not load roster", "error")
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per teamId
  }, [teamId])

  const filteredPlayers = useMemo(() => {
    if (!rosterData?.players) return []
    return rosterData.players.filter((p) => selectedIds.has(p.id))
  }, [rosterData, selectedIds])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (!rosterData?.players) return
    setSelectedIds(new Set(rosterData.players.map((p) => p.id)))
  }, [rosterData])

  const selectNone = useCallback(() => setSelectedIds(new Set()), [])

  const handleSend = async () => {
    if (!recipientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      showToast("Enter a valid recipient email", "error")
      return
    }
    if (filteredPlayers.length === 0) {
      showToast("Select at least one player", "error")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/roster/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          recipientEmail: recipientEmail.trim(),
          subject: subject.trim() || undefined,
          message: message.trim() || undefined,
          playerIds: filteredPlayers.map((p) => p.id),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        showToast(`Email sent (${filteredPlayers.length} players)`, "success")
        onClose()
      } else if (res.status === 503) {
        showToast(data.hint || data.detail || "Configure Postmark (POSTMARK_SERVER_TOKEN)", "error")
      } else {
        showToast(data.error || "Failed to send", "error")
      }
    } catch {
      showToast("Failed to send email", "error")
    } finally {
      setSending(false)
    }
  }

  if (loading || !rosterData) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-lg p-8 text-foreground">
          <p>{loading ? "Loading roster…" : "Could not load roster"}</p>
          {!loading && (
            <Button className="mt-4" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    )
  }

  const { team, template, generatedAt } = rosterData
  const tb = template.body

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <Card className="w-full max-w-3xl max-h-[95vh] flex flex-col bg-card border-border text-foreground my-4">
        <CardHeader className="shrink-0 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-lg truncate">Email roster (Postmark)</CardTitle>
            </div>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Preview matches the email body. Sending uses Postmark when{" "}
            <code className="text-xs bg-muted px-1 rounded">POSTMARK_SERVER_TOKEN</code> is set.
          </p>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4 pt-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="to">To (recipient)</Label>
              <Input
                id="to"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="coach@school.edu"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subj">Subject</Label>
              <Input id="subj" value={subject} onChange={(e) => setSubject(e.target.value)} className="bg-background" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="msg">Message (optional, appears above the table)</Label>
            <textarea
              id="msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-h-[80px] rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Short note to include in the email…"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Players in email</span>
            <Button type="button" variant="outline" size="sm" onClick={selectAll}>
              Select all
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={selectNone}>
              Clear
            </Button>
            <span className="text-sm text-muted-foreground">
              {filteredPlayers.length} of {rosterData.players.length} selected
            </span>
            <Button
              type="button"
              variant={showPreview ? "secondary" : "outline"}
              size="sm"
              className="ml-auto"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {showPreview ? "Hide preview" : "Show preview"}
            </Button>
          </div>

          <div className="rounded-md border border-border overflow-hidden max-h-40 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="w-10 p-2 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all visible"
                      checked={
                        rosterData.players.length > 0 &&
                        rosterData.players.every((p) => selectedIds.has(p.id))
                      }
                      onChange={(e) => (e.target.checked ? selectAll() : selectNone())}
                    />
                  </th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left w-16">#</th>
                </tr>
              </thead>
              <tbody>
                {rosterData.players.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-2">
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggle(p.id)} />
                    </td>
                    <td className="p-2">{p.name}</td>
                    <td className="p-2">{p.jerseyNumber ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showPreview && (
            <div className="rounded-lg border border-border bg-white text-black p-6 shadow-inner">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Email preview</p>
              <div className="text-center mb-4">
                {template.header.showYear && (
                  <p className="text-sm text-gray-700">
                    <strong>{template.header.yearLabel}:</strong> {team.year}
                  </p>
                )}
                {template.header.showSchoolName && team.schoolName && (
                  <p className="text-sm text-gray-700">
                    <strong>{template.header.schoolNameLabel}:</strong> {team.schoolName}
                  </p>
                )}
                {template.header.showTeamName && <h2 className="text-xl font-bold mt-1">{team.name}</h2>}
              </div>
              {message.trim() && (
                <div className="mb-4 p-3 bg-slate-50 border-l-4 border-blue-500 text-sm text-slate-700 whitespace-pre-wrap">
                  {message}
                </div>
              )}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    {tb.showJerseyNumber && (
                      <th className="border border-gray-300 px-2 py-1 text-left">{tb.jerseyNumberLabel}</th>
                    )}
                    {tb.showPlayerName && (
                      <th className="border border-gray-300 px-2 py-1 text-left">{tb.playerNameLabel}</th>
                    )}
                    {tb.showGrade && <th className="border border-gray-300 px-2 py-1 text-left">{tb.gradeLabel}</th>}
                    {tb.showPosition !== false && (
                      <th className="border border-gray-300 px-2 py-1 text-left">{tb.positionLabel ?? "Pos"}</th>
                    )}
                    {tb.showWeight !== false && (
                      <th className="border border-gray-300 px-2 py-1 text-left">{tb.weightLabel ?? "Wt"}</th>
                    )}
                    {tb.showHeight !== false && (
                      <th className="border border-gray-300 px-2 py-1 text-left">{tb.heightLabel ?? "Ht"}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((p) => (
                    <tr key={p.id}>
                      {tb.showJerseyNumber && (
                        <td className="border border-gray-300 px-2 py-1">{p.jerseyNumber ?? ""}</td>
                      )}
                      {tb.showPlayerName && <td className="border border-gray-300 px-2 py-1">{p.name}</td>}
                      {tb.showGrade && (
                        <td className="border border-gray-300 px-2 py-1">{p.gradeLabel ?? p.grade ?? ""}</td>
                      )}
                      {tb.showPosition !== false && (
                        <td className="border border-gray-300 px-2 py-1">{p.position ?? ""}</td>
                      )}
                      {tb.showWeight !== false && (
                        <td className="border border-gray-300 px-2 py-1">{p.weight ?? ""}</td>
                      )}
                      {tb.showHeight !== false && (
                        <td className="border border-gray-300 px-2 py-1">{p.height ?? ""}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {template.footer.showGeneratedDate && (
                <p className="text-center text-xs text-gray-500 mt-4">
                  Generated: {new Date(generatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2 border-t border-border">
            <Button onClick={handleSend} disabled={sending || !recipientEmail.trim()} className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              {sending ? "Sending…" : "Send email"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
