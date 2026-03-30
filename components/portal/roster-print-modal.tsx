"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Printer, Settings, Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  parseRosterPrintClientData,
  ROSTER_PRINT_PORTAL_CSS,
  type RosterPrintClientData,
} from "@/lib/roster/roster-print-payload"

interface RosterPrintModalProps {
  teamId: string
  onClose: () => void
}

export function RosterPrintModal({ teamId, onClose }: RosterPrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [rosterData, setRosterData] = useState<RosterPrintClientData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** In-modal roster layout preview; print stays disabled until user opens preview (guided flow). */
  const [previewVisible, setPreviewVisible] = useState(false)
  /** Guided flow: 1 = select players, 2 = preview step, 3 = print. */
  const [flowStep, setFlowStep] = useState<1 | 2 | 3>(1)

  const togglePlayer = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }, [])

  const selectAllPlayers = useCallback(() => {
    if (!rosterData?.players?.length) return
    setSelectedIds(new Set(rosterData.players.map((p) => p.id)))
  }, [rosterData])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const playersToPrint = useMemo(() => {
    const pl = rosterData?.players ?? []
    return pl.filter((p) => selectedIds.has(p.id))
  }, [rosterData, selectedIds])

  const allSelected = useMemo(() => {
    const pl = rosterData?.players ?? []
    return pl.length > 0 && pl.every((p) => selectedIds.has(p.id))
  }, [rosterData, selectedIds])

  const hasPlayers = playersToPrint.length > 0

  useEffect(() => {
    setPreviewVisible(false)
    setFlowStep(1)
  }, [teamId])

  useEffect(() => {
    const loadRoster = async () => {
      setLoadError(null)
      try {
        const response = await fetch(
          `/api/roster/print?teamId=${encodeURIComponent(teamId)}&fullRoster=1`
        )
        const data: unknown = await response.json().catch(() => null)
        if (!response.ok) {
          const body = data && typeof data === "object" ? (data as Record<string, unknown>) : null
          const message =
            body && typeof body.error === "string"
              ? body.error
              : `Could not load roster for printing (${response.status}).`
          setLoadError(message)
          setRosterData(null)
          return
        }
        const normalized = parseRosterPrintClientData(data)
        if (!normalized) {
          setLoadError("The server returned an unexpected roster print response. Try again or refresh the page.")
          setRosterData(null)
          return
        }
        setRosterData(normalized)
        setSelectedIds(new Set(normalized.players.map((p) => p.id)))
        setPreviewVisible(false)
        setFlowStep(1)
      } catch (error) {
        console.error("Failed to load roster:", error)
        setLoadError("Network error while loading the roster. Check your connection and try again.")
        setRosterData(null)
      } finally {
        setLoading(false)
      }
    }
    loadRoster()
  }, [teamId])

  const handlePrint = () => {
    const el = printRef.current
    const players = rosterData?.players ?? []
    console.log("[roster-print-modal] handlePrint", {
      printRefExists: !!el,
      playerCount: players.length,
      templateExists: !!rosterData?.template,
    })
    if (!el) {
      console.warn("[roster-print-modal] Print aborted: printable container ref not mounted")
      return
    }
    if (!rosterData) {
      console.warn("[roster-print-modal] Print aborted: no roster data")
      return
    }
    if (!previewVisible) {
      console.warn("[roster-print-modal] Print aborted: preview not shown yet")
      return
    }
    // Wait for layout/paint so printable content is in the DOM before opening print dialog
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
  }

  if (loading) {
    return (
      <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="no-print sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Printer className="h-5 w-5 text-primary shrink-0" aria-hidden />
              Print Roster
            </DialogTitle>
            <DialogDescription>Loading roster data…</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground" aria-busy="true">
            Loading roster…
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!rosterData) {
    return (
      <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="no-print sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Print Roster</DialogTitle>
            <DialogDescription>{loadError ?? "Failed to load roster data"}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const { team, template, players, generatedAt } = rosterData

  const printBody = (
    <>
      <div className="text-center mb-8">
        {template.header.showYear && (
          <p className="text-sm text-gray-700 mb-1">
            <strong>{template.header.yearLabel}:</strong> {team.year}
          </p>
        )}
        {template.header.showSchoolName && team.schoolName && (
          <p className="text-sm text-gray-700 mb-1">
            <strong>{template.header.schoolNameLabel}:</strong> {team.schoolName}
          </p>
        )}
        {template.header.showTeamName && (
          <h1 className="text-3xl font-bold mt-2 text-black">{team.name}</h1>
        )}
      </div>
      {hasPlayers ? (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {template.body.showJerseyNumber && (
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">
                  {template.body.jerseyNumberLabel}
                </th>
              )}
              {template.body.showPlayerName && (
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">
                  {template.body.playerNameLabel}
                </th>
              )}
                    {template.body.showGrade && (
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">
                        {template.body.gradeLabel}
                      </th>
                    )}
                    {(template.body.showPosition !== false) && (
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">
                        {template.body.positionLabel ?? "Position"}
                      </th>
                    )}
                    {(template.body.showWeight !== false) && (
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">
                        {template.body.weightLabel ?? "Weight"}
                      </th>
                    )}
                    {(template.body.showHeight !== false) && (
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">
                        {template.body.heightLabel ?? "Height"}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {playersToPrint.map((player, idx) => (
                    <tr key={player.id || idx}>
                      {template.body.showJerseyNumber && (
                        <td className="border border-gray-300 px-4 py-2 text-black">
                          {player.jerseyNumber ?? ""}
                        </td>
                      )}
                      {template.body.showPlayerName && (
                        <td className="border border-gray-300 px-4 py-2 text-black">
                          {player.name}
                        </td>
                      )}
                      {template.body.showGrade && (
                        <td className="border border-gray-300 px-4 py-2 text-black">
                          {player.gradeLabel ?? player.grade ?? ""}
                        </td>
                      )}
                      {(template.body.showPosition !== false) && (
                        <td className="border border-gray-300 px-4 py-2 text-black">
                          {player.position ?? ""}
                        </td>
                      )}
                      {(template.body.showWeight !== false) && (
                        <td className="border border-gray-300 px-4 py-2 text-black">
                          {player.weight != null ? player.weight : ""}
                        </td>
                      )}
                      {(template.body.showHeight !== false) && (
                        <td className="border border-gray-300 px-4 py-2 text-black">
                          {player.height ?? ""}
                        </td>
                      )}
                    </tr>
                  ))}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-700 py-8 text-center font-medium">
          {players?.length
            ? "Select at least one player to print."
            : "No roster data to print. Add players to this team first."}
        </p>
      )}
      {(template.footer.showGeneratedDate || template.footer.customText) && (
        <div className="mt-8 text-center text-sm text-gray-700">
          {template.footer.showGeneratedDate && (
            <p>Generated: {new Date(generatedAt).toLocaleDateString()}</p>
          )}
          {template.footer.customText && (
            <p className="mt-2">{template.footer.customText}</p>
          )}
        </div>
      )}
    </>
  )

  return (
    <>
      <Dialog open={true} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          className={cn(
            "no-print flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 lg:max-h-[90vh]",
            "w-[min(100vw-1rem,56rem)] max-w-[min(100vw-1rem,56rem)] lg:max-w-5xl"
          )}
        >
          <DialogHeader className="no-print shrink-0 space-y-3 border-b border-border px-4 pb-3 pt-2 md:px-6 md:pb-4 md:pt-4">
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
              <span className={flowStep >= 1 ? "font-semibold text-foreground" : ""}>1. Select</span>
              <span aria-hidden>→</span>
              <span className={flowStep >= 2 ? "font-semibold text-foreground" : ""}>2. Preview</span>
              <span aria-hidden>→</span>
              <span className={flowStep >= 3 ? "font-semibold text-foreground" : ""}>3. Print</span>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <DialogTitle className="flex items-center gap-2 text-left text-foreground">
                  <Printer className="h-5 w-5 text-primary shrink-0" aria-hidden />
                  Print Roster
                </DialogTitle>
                <DialogDescription className="text-left">
                  Select players, preview the layout, then print. Browser print dialog opens when you click Print.
                </DialogDescription>
              </div>
              <Button variant="outline" size="sm" type="button" onClick={() => setShowSettings(!showSettings)} className="shrink-0">
                <Settings className="h-4 w-4 mr-2" aria-hidden />
                Printer Settings
              </Button>
            </div>
          </DialogHeader>

          <div className="no-print flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 md:px-6 md:py-5">
            {flowStep === 1 && (
              <div className="no-print mb-4 rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Step 1 — Players to print</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Button type="button" size="sm" variant="outline" onClick={selectAllPlayers}>
                    Select all
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={clearSelection}>
                    Clear
                  </Button>
                  <span className="text-muted-foreground text-sm self-center">
                    {playersToPrint.length} of {players?.length ?? 0} selected
                  </span>
                </div>
                <p className="text-muted-foreground text-xs mb-2 lg:hidden">
                  Select players, then continue to preview and print.
                </p>
                <div className="max-h-48 lg:max-h-56 overflow-y-auto rounded-md border border-border bg-background">
                  <table className="w-full text-sm text-foreground">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="w-10 p-2 text-left">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => (e.target.checked ? selectAllPlayers() : clearSelection())}
                            aria-label="Select all"
                          />
                        </th>
                        <th className="p-2 text-left font-medium">Name</th>
                        <th className="p-2 text-left w-14 font-medium">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(players || []).map((p) => (
                        <tr key={p.id} className="border-b border-border/80">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={() => togglePlayer(p.id)}
                            />
                          </td>
                          <td className="p-2">{p.name}</td>
                          <td className="p-2">{p.jerseyNumber ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="no-print flex flex-wrap gap-3 mt-4">
                  <Button type="button" onClick={() => hasPlayers && setFlowStep(2)} disabled={!hasPlayers}>
                    Continue to preview
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {flowStep >= 2 && (
              <>
                {showSettings && (
                  <div className="no-print mb-6 rounded-lg border border-border bg-muted/30 p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-2">Printer Settings</h3>
                    <ul className="text-muted-foreground text-sm space-y-1 list-disc list-inside">
                      <li>Recommended: Portrait orientation</li>
                      <li>Paper size: Letter (8.5&quot; x 11&quot;)</li>
                      <li>Turn off &quot;Headers and footers&quot; in the print dialog to hide date, URL, and page numbers</li>
                      <li>Scale: 100% (default)</li>
                      <li>Background graphics: Enabled (if available)</li>
                    </ul>
                  </div>
                )}

                <div className="no-print mb-3">
                  <h3 className="text-sm font-semibold text-foreground lg:text-base">
                    {flowStep === 2 && !previewVisible
                      ? "Step 2 — Preview layout"
                      : "Step 3 — Print"}
                  </h3>
                  <p className="text-muted-foreground text-xs mt-1">
                    Preview stays hidden until you click <strong className="text-foreground">Preview</strong>. Then use{" "}
                    <strong className="text-foreground">Print</strong>.
                  </p>
                </div>

                {previewVisible ? (
                  <div
                    className="no-print mx-auto max-w-4xl rounded-lg border border-border bg-white p-8 text-black lg:p-10"
                    style={{ width: "8.5in" }}
                  >
                    {printBody}
                  </div>
                ) : (
                  <div className="no-print rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                    Preview is hidden. Click <strong className="text-foreground">Preview</strong> to see how the roster will print.
                  </div>
                )}

                <div className="no-print mt-6 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPreviewVisible(true)
                      setFlowStep(3)
                    }}
                    disabled={!hasPlayers || previewVisible}
                  >
                    <Eye className="h-4 w-4 mr-2" aria-hidden />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePrint}
                    className="min-w-[140px] flex-1"
                    disabled={!hasPlayers || !previewVisible}
                  >
                    <Printer className="h-4 w-4 mr-2" aria-hidden />
                    Print
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setFlowStep(1)
                      setPreviewVisible(false)
                    }}
                  >
                    Back
                  </Button>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Printable content rendered into body so @media print can hide entire page and show only this */}
      {typeof document !== "undefined" &&
        document.body &&
        previewVisible &&
        createPortal(
          <div
            className="roster-print-portal"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              top: 0,
              width: "1px",
              height: "1px",
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              ref={printRef}
              className="roster-print-root bg-white p-8 max-w-4xl text-black"
              style={{ width: "8.5in" }}
            >
              {printBody}
            </div>
          </div>,
          document.body
        )}

      <style dangerouslySetInnerHTML={{ __html: ROSTER_PRINT_PORTAL_CSS }} />
    </>
  )
}
