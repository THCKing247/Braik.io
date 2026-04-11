"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Mail, Send, Eye, ChevronRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { parseRosterPrintClientData } from "@/lib/roster/roster-print-payload"

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
  rosterStatus?: string
  healthStatus?: string | null
}

type PostmarkStatusPayload = {
  configured: boolean
  fromEmail: string | null
  messageStream: string
  missing: string[]
  userMessage: string
  hasServerToken: boolean
}

type RosterData = {
  team: { name: string; schoolName: string | null; year: number }
  template: {
    header: {
      showYear: boolean
      showSchoolName: boolean
      showTeamName: boolean
      yearLabel: string
      schoolNameLabel: string
      teamNameLabel: string
    }
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

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Comma- or semicolon-separated CC list; empty is valid. */
function normalizeCcInput(raw: string): { ok: true; cc: string } | { ok: false; error: string } {
  const t = raw.trim()
  if (!t) return { ok: true, cc: "" }
  const parts = t
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean)
  for (const p of parts) {
    if (!SIMPLE_EMAIL.test(p)) {
      return { ok: false, error: `Invalid CC address: ${p}` }
    }
  }
  return { ok: true, cc: parts.join(", ") }
}

function emailPlayerMatchesStatusFilter(p: RosterRow, filter: string): boolean {
  if (!filter) return true
  const roster = (p.rosterStatus ?? "active").toLowerCase()
  const health = (p.healthStatus ?? "active").toLowerCase()
  if (filter === "injured") return health === "injured"
  if (filter === "inactive") return roster !== "active"
  if (filter === "unavailable") return health === "unavailable"
  if (filter === "active") return roster === "active" && health === "active"
  return true
}

export function RosterEmailModal({ teamId, onClose }: RosterEmailModalProps) {
  const { showToast } = usePlaybookToast()
  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [recipientEmail, setRecipientEmail] = useState("")
  const [ccEmail, setCcEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState("")
  /** 1 players → 2 compose → 3 preview → 4 send */
  const [flowStep, setFlowStep] = useState<1 | 2 | 3 | 4>(1)
  const [postmarkLoading, setPostmarkLoading] = useState(true)
  const [postmarkStatus, setPostmarkStatus] = useState<PostmarkStatusPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadPostmark = async () => {
      setPostmarkLoading(true)
      try {
        const res = await fetch(`/api/email/postmark-status?teamId=${encodeURIComponent(teamId)}`)
        const data = (await res.json().catch(() => ({}))) as Partial<PostmarkStatusPayload> & { error?: string }
        if (!cancelled && res.ok && typeof data.configured === "boolean") {
          setPostmarkStatus({
            configured: data.configured,
            fromEmail: data.fromEmail ?? null,
            messageStream: data.messageStream ?? "outbound",
            missing: Array.isArray(data.missing) ? data.missing : [],
            userMessage: typeof data.userMessage === "string" ? data.userMessage : "",
            hasServerToken: Boolean(data.hasServerToken),
          })
        } else if (!cancelled) {
          setPostmarkStatus(null)
        }
      } catch {
        if (!cancelled) setPostmarkStatus(null)
      } finally {
        if (!cancelled) setPostmarkLoading(false)
      }
    }
    void loadPostmark()
    return () => {
      cancelled = true
    }
  }, [teamId])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/roster/print?teamId=${encodeURIComponent(teamId)}&fullRoster=1`)
        if (!res.ok) {
          showToast("Could not load roster", "error")
          setRosterData(null)
          return
        }
        const raw: unknown = await res.json()
        const parsed = parseRosterPrintClientData(raw)
        if (!parsed) {
          showToast("Could not load roster", "error")
          setRosterData(null)
          return
        }
        const data: RosterData = {
          team: parsed.team,
          template: parsed.template,
          players: parsed.players as RosterRow[],
          generatedAt: parsed.generatedAt,
        }
        setRosterData(data)
        const ids = data.players.map((p) => p.id)
        setSelectedIds(new Set(ids))
        setEmailPreviewOpen(false)
        setFlowStep(1)
        setSubject(`Roster — ${data.team?.name ?? "Team"} — ${new Date().toLocaleDateString()}`)
      } catch {
        showToast("Could not load roster", "error")
        setRosterData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per teamId
  }, [teamId])

  const playersForSelector = useMemo(() => {
    if (!rosterData?.players) return []
    return rosterData.players.filter((p) => emailPlayerMatchesStatusFilter(p, statusFilter))
  }, [rosterData, statusFilter])

  const filteredPlayers = useMemo(() => {
    return playersForSelector.filter((p) => selectedIds.has(p.id))
  }, [playersForSelector, selectedIds])

  const ccSummary = useMemo(() => normalizeCcInput(ccEmail), [ccEmail])

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(playersForSelector.map((p) => p.id)))
  }, [playersForSelector])

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
    if (postmarkStatus && !postmarkStatus.configured) {
      showToast(postmarkStatus.userMessage, "error")
      return
    }

    const ccNorm = normalizeCcInput(ccEmail)
    if (!ccNorm.ok) {
      showToast(ccNorm.error, "error")
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
          ...(ccNorm.cc ? { cc: ccNorm.cc } : {}),
          subject: subject.trim() || undefined,
          message: message.trim() || undefined,
          playerIds: filteredPlayers.map((p) => p.id),
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        code?: string
        message?: string
        error?: string
        hint?: string
        detail?: string
      }
      if (res.ok) {
        showToast(`Email sent (${filteredPlayers.length} players)`, "success")
        onClose()
      } else if (res.status === 503 && data.code === "POSTMARK_NOT_CONFIGURED") {
        showToast(
          data.message ||
            data.error ||
            "Postmark is not configured. Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL, and verify the sender in Postmark.",
          "error"
        )
      } else {
        showToast(data.message || data.error || data.hint || data.detail || "Failed to send", "error")
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
      <Card className="w-full max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[95vh] flex flex-col bg-card border-border text-foreground my-4 shadow-xl">
        <CardHeader className="shrink-0 border-b border-border lg:py-6">
          <div className="hidden lg:flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <span className={flowStep >= 1 ? "text-foreground font-semibold" : ""}>1. Players</span>
            <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
            <span className={flowStep >= 2 ? "text-foreground font-semibold" : ""}>2. Compose</span>
            <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
            <span className={flowStep >= 3 ? "text-foreground font-semibold" : ""}>3. Preview</span>
            <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
            <span className={flowStep >= 4 ? "text-foreground font-semibold" : ""}>4. Send</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-lg lg:text-xl truncate">Email roster (Postmark)</CardTitle>
            </div>
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1 lg:mt-2">
            {postmarkLoading && "Checking email configuration…"}
            {!postmarkLoading && postmarkStatus?.configured && postmarkStatus.fromEmail && (
              <>
                Sending via Postmark from <span className="font-medium text-foreground">{postmarkStatus.fromEmail}</span>{" "}
                (stream: {postmarkStatus.messageStream}).
              </>
            )}
            {!postmarkLoading && postmarkStatus && !postmarkStatus.configured && "Email sending is disabled until Postmark is configured on the server."}
            {!postmarkLoading && !postmarkStatus &&
              "Could not load email settings. You can still try to send; the server validates Postmark configuration."}
          </p>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4 pt-4 lg:pt-6 lg:px-8 min-h-0">
          {!postmarkLoading && postmarkStatus && !postmarkStatus.configured && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100"
              role="alert"
            >
              {postmarkStatus.userMessage}
            </div>
          )}
          {flowStep === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="email-status-filter">Filter by player status</Label>
                <select
                  id="email-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 w-full max-w-md rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active / healthy</option>
                  <option value="injured">Injured</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="inactive">Inactive (roster)</option>
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">Players in email</span>
                <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
                  Select all (visible)
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={selectNone}>
                  Clear
                </Button>
                <span className="text-sm text-muted-foreground">
                  {filteredPlayers.length} of {playersForSelector.length} selected (visible)
                </span>
              </div>
              <div className="rounded-md border border-border overflow-hidden max-h-56 lg:max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="w-10 p-2 text-left">
                        <input
                          type="checkbox"
                          aria-label="Select all visible"
                          checked={
                            playersForSelector.length > 0 &&
                            playersForSelector.every((p) => selectedIds.has(p.id))
                          }
                          onChange={(e) => (e.target.checked ? selectAllVisible() : selectNone())}
                        />
                      </th>
                      <th className="p-2 text-left">Name</th>
                      <th className="p-2 text-left w-16">#</th>
                      <th className="p-2 text-left hidden sm:table-cell">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {playersForSelector.map((p) => {
                      const roster = (p.rosterStatus ?? "active").toLowerCase()
                      const health = (p.healthStatus ?? "active").toLowerCase()
                      let statusLabel = "Active"
                      if (roster !== "active") statusLabel = "Inactive"
                      else if (health === "injured") statusLabel = "Injured"
                      else if (health === "unavailable") statusLabel = "Unavailable"
                      return (
                        <tr key={p.id} className="border-t border-border">
                          <td className="p-2">
                            <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggle(p.id)} />
                          </td>
                          <td className="p-2">{p.name}</td>
                          <td className="p-2">{p.jerseyNumber ?? "—"}</td>
                          <td className="p-2 hidden sm:table-cell text-muted-foreground">{statusLabel}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" onClick={() => filteredPlayers.length > 0 && setFlowStep(2)} disabled={filteredPlayers.length === 0}>
                  Continue to compose
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {flowStep === 2 && (
            <>
              <div className="grid sm:grid-cols-2 gap-4 lg:gap-6">
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
                <Label htmlFor="roster-email-cc">Cc (optional)</Label>
                <Input
                  id="roster-email-cc"
                  type="text"
                  value={ccEmail}
                  onChange={(e) => setCcEmail(e.target.value)}
                  placeholder="assistant@school.edu, admin@school.edu"
                  className="bg-background"
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">Separate multiple addresses with commas or semicolons.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="msg">Message (optional, appears above the table)</Label>
                <textarea
                  id="msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full min-h-[100px] lg:min-h-[120px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Short note to include in the email…"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" onClick={() => setFlowStep(3)}>
                  Continue to preview
                </Button>
                <Button type="button" variant="outline" onClick={() => setFlowStep(1)}>
                  Back
                </Button>
              </div>
            </>
          )}

          {flowStep === 3 && (
            <>
              <p className="text-sm text-muted-foreground">
                Email preview is hidden until you click <strong className="text-foreground">Preview</strong>.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEmailPreviewOpen(true)}
                  disabled={emailPreviewOpen}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                {emailPreviewOpen ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEmailPreviewOpen(false)}>
                    Hide preview
                  </Button>
                ) : null}
              </div>
              {emailPreviewOpen && (
                <div className="rounded-lg border border-border bg-white text-black p-6 lg:p-8 shadow-inner max-h-[50vh] overflow-y-auto">
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
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  onClick={() => setFlowStep(4)}
                  disabled={!emailPreviewOpen || postmarkStatus?.configured === false}
                >
                  Continue to send
                </Button>
                <Button type="button" variant="outline" onClick={() => setFlowStep(2)}>
                  Back
                </Button>
              </div>
            </>
          )}

          {flowStep === 4 && (
            <>
              <p className="text-sm text-muted-foreground">
                Ready to send to <strong className="text-foreground">{recipientEmail || "—"}</strong>
                {ccSummary.ok && ccSummary.cc ? (
                  <>
                    {" "}
                    with Cc <strong className="text-foreground">{ccSummary.cc}</strong>
                  </>
                ) : null}{" "}
                with <strong className="text-foreground">{filteredPlayers.length}</strong> player
                {filteredPlayers.length === 1 ? "" : "s"}.
              </p>
              <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                <Button
                  onClick={handleSend}
                  disabled={
                    sending || !recipientEmail.trim() || postmarkLoading || postmarkStatus?.configured === false
                  }
                  className="min-w-[160px]"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending…" : "Send email"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setFlowStep(3)}>
                  Back
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
