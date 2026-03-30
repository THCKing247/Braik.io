"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { X, Printer, Settings, Eye } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-[#1e3a5f] rounded-lg p-8 text-white">
          <p>Loading roster...</p>
        </div>
      </div>
    )
  }

  if (!rosterData) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-[#1e3a5f] rounded-lg p-8 text-white max-w-md text-center">
          <p>{loadError ?? "Failed to load roster data"}</p>
          <Button onClick={onClose} className="mt-4">
            Close
          </Button>
        </div>
      </div>
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
      {/* Modal chrome - hidden in print via .no-print so only roster-print-root is visible */}
      <div className="no-print fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <Card className="no-print w-full max-w-4xl lg:max-w-5xl bg-[#1e3a5f] border-[#1e3a5f] max-h-[90vh] flex flex-col">
          <CardHeader className="no-print flex-shrink-0">
            <div className="hidden lg:flex items-center gap-2 mb-3 text-xs text-white/70">
              <span className={flowStep >= 1 ? "text-white font-semibold" : ""}>1. Select</span>
              <span aria-hidden>→</span>
              <span className={flowStep >= 2 ? "text-white font-semibold" : ""}>2. Preview</span>
              <span aria-hidden>→</span>
              <span className={flowStep >= 3 ? "text-white font-semibold" : ""}>3. Print</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Printer className="h-6 w-6 text-white" />
                <CardTitle className="text-white">Print Roster</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-white border-white/20"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Printer Settings
                </Button>
                <button
                  onClick={onClose}
                  className="text-white/70 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="no-print flex-1 overflow-y-auto min-h-0">
            {flowStep === 1 && (
              <div className="no-print mb-4 p-4 bg-white/10 rounded-lg border border-white/20">
                <h3 className="text-white font-semibold mb-2">Step 1 — Players to print</h3>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-white border-white/30"
                    onClick={selectAllPlayers}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-white border-white/30"
                    onClick={clearSelection}
                  >
                    Clear
                  </Button>
                  <span className="text-white/80 text-sm self-center">
                    {playersToPrint.length} of {players?.length ?? 0} selected
                  </span>
                </div>
                <p className="text-white/70 text-xs mb-2 lg:hidden">
                  Select players, then continue to preview and print.
                </p>
                <div className="max-h-48 lg:max-h-56 overflow-y-auto rounded border border-white/20 bg-black/20">
                  <table className="w-full text-sm text-white">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="w-10 p-2 text-left">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => (e.target.checked ? selectAllPlayers() : clearSelection())}
                            aria-label="Select all"
                          />
                        </th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left w-14">#</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(players || []).map((p) => (
                        <tr key={p.id} className="border-b border-white/10">
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
                  <Button
                    type="button"
                    className="bg-white text-[#1e3a5f] hover:bg-white/90"
                    onClick={() => hasPlayers && setFlowStep(2)}
                    disabled={!hasPlayers}
                  >
                    Continue to preview
                  </Button>
                  <Button variant="outline" onClick={onClose} className="text-white border-white/30">
                    Close
                  </Button>
                </div>
              </div>
            )}

            {flowStep >= 2 && (
              <>
                {showSettings && (
                  <div className="no-print mb-6 p-4 bg-white/10 rounded-lg border border-white/20">
                    <h3 className="text-white font-semibold mb-2">Printer Settings</h3>
                    <ul className="text-white/80 text-sm space-y-1 list-disc list-inside">
                      <li>Recommended: Portrait orientation</li>
                      <li>Paper size: Letter (8.5&quot; x 11&quot;)</li>
                      <li>Turn off &quot;Headers and footers&quot; in the print dialog to hide date, URL, and page numbers</li>
                      <li>Scale: 100% (default)</li>
                      <li>Background graphics: Enabled (if available)</li>
                    </ul>
                  </div>
                )}

                <div className="no-print mb-3">
                  <h3 className="text-white font-semibold text-sm lg:text-base">
                    {flowStep === 2 && !previewVisible
                      ? "Step 2 — Preview layout"
                      : "Step 3 — Print"}
                  </h3>
                  <p className="text-white/70 text-xs mt-1">
                    Preview stays hidden until you click <strong className="text-white">Preview</strong>. Then use{" "}
                    <strong className="text-white">Print</strong>.
                  </p>
                </div>

                {previewVisible ? (
                  <div
                    className="no-print bg-white p-8 mx-auto max-w-4xl text-black rounded-lg border border-white/20 lg:p-10"
                    style={{ width: "8.5in" }}
                  >
                    {printBody}
                  </div>
                ) : (
                  <div className="no-print rounded-lg border border-dashed border-white/30 bg-white/5 px-4 py-6 text-center text-sm text-white/80">
                    Preview is hidden. Click <strong className="text-white">Preview</strong> to see how the roster will print.
                  </div>
                )}

                <div className="no-print flex flex-wrap gap-3 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="text-white border-white/30"
                    onClick={() => {
                      setPreviewVisible(true)
                      setFlowStep(3)
                    }}
                    disabled={!hasPlayers || previewVisible}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                  <Button onClick={handlePrint} className="flex-1 min-w-[140px]" disabled={!hasPlayers || !previewVisible}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-white border-white/30"
                    onClick={() => {
                      setFlowStep(1)
                      setPreviewVisible(false)
                    }}
                  >
                    Back
                  </Button>
                  <Button variant="outline" onClick={onClose} className="text-white border-white/30">
                    Close
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
