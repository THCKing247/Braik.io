"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"
import { X, Printer, Settings } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface RosterPrintModalProps {
  teamId: string
  onClose: () => void
}

interface RosterData {
  team: {
    id: string
    name: string
    schoolName: string | null
    seasonName: string | null
    year: number
  }
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
      sortBy: string
    }
    footer: {
      showGeneratedDate: boolean
      customText: string
    }
  }
  players: Array<{
    jerseyNumber: number | null
    name: string
    grade: number | null
    gradeLabel: string | null
    position: string | null
    weight: number | null
    height: string | null
  }>
  generatedAt: string
}

export function RosterPrintModal({ teamId, onClose }: RosterPrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const loadRoster = async () => {
      try {
        const response = await fetch(`/api/roster/print?teamId=${teamId}`)
        if (response.ok) {
          const data = await response.json()
          console.log("[roster-print-modal] API response payload", {
            hasTeam: !!data?.team,
            hasTemplate: !!data?.template,
            playerCount: data?.players?.length ?? 0,
            teamName: data?.team?.name,
          })
          setRosterData(data)
        } else {
          const body = await response.json().catch(() => ({}))
          const message = typeof body?.error === "string" ? body.error : "Failed to load roster data"
          alert(message)
        }
      } catch (error) {
        console.error("Failed to load roster:", error)
        alert("Failed to load roster data")
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
        <div className="bg-[#1e3a5f] rounded-lg p-8 text-white">
          <p>Failed to load roster data</p>
          <Button onClick={onClose} className="mt-4">Close</Button>
        </div>
      </div>
    )
  }

  const { team, template, players, generatedAt } = rosterData
  const hasPlayers = Array.isArray(players) && players.length > 0

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
                  {players.map((player, idx) => (
                    <tr key={idx}>
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
          No roster data to print. Add players to this team first.
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
        <Card className="no-print w-full max-w-4xl bg-[#1e3a5f] border-[#1e3a5f] max-h-[90vh] flex flex-col">
          <CardHeader className="no-print flex-shrink-0">
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

          <CardContent className="no-print flex-1 overflow-y-auto">
            {showSettings && (
              <div className="no-print mb-6 p-4 bg-white/10 rounded-lg border border-white/20">
                <h3 className="text-white font-semibold mb-2">Printer Settings</h3>
                <ul className="text-white/80 text-sm space-y-1 list-disc list-inside">
                  <li>Recommended: Portrait orientation</li>
                  <li>Paper size: Letter (8.5" x 11")</li>
                  <li>Turn off &quot;Headers and footers&quot; in the print dialog to hide date, URL, and page numbers</li>
                  <li>Scale: 100% (default)</li>
                  <li>Background graphics: Enabled (if available)</li>
                </ul>
              </div>
            )}

            <div className="no-print bg-white p-8 mx-auto max-w-4xl text-black rounded-lg" style={{ width: "8.5in" }}>
              {printBody}
            </div>

            <div className="no-print flex gap-3 mt-6">
              <Button onClick={handlePrint} className="flex-1">
                <Printer className="h-4 w-4 mr-2" />
                Print Roster
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Printable content rendered into body so @media print can hide entire page and show only this */}
      {typeof document !== "undefined" &&
        document.body &&
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

      <style jsx global>{`
        @media print {
          /* Remove browser header/footer (date, URL, page number) by using no page margin */
          @page {
            margin: 0 !important;
            size: auto;
          }
          /* Hide entire page with display:none so only portal takes space (prevents 2nd blank page) */
          body * {
            display: none !important;
          }
          body > .roster-print-portal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            pointer-events: auto !important;
          }
          body > .roster-print-portal * {
            display: revert !important;
            visibility: visible !important;
            color: black !important;
          }
          body > .roster-print-portal .roster-print-root {
            display: block !important;
            position: static !important;
            margin: 0 auto !important;
            padding: 0.5in !important;
            color: black !important;
          }
        }
      `}</style>
    </>
  )
}
