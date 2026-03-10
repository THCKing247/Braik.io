"use client"

import { useState, useEffect, useRef } from "react"
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
      jerseyNumberLabel: string
      playerNameLabel: string
      gradeLabel: string
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
    if (!printRef.current) return
    
    // Open print dialog
    window.print()
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

  return (
    <>
      {/* Dark Modal Overlay */}
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
        <Card className="w-full max-w-4xl bg-[#1e3a5f] border-[#1e3a5f] max-h-[90vh] flex flex-col">
          <CardHeader className="flex-shrink-0">
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

          <CardContent className="flex-1 overflow-y-auto">
            {/* Printer Settings Info */}
            {showSettings && (
              <div className="mb-6 p-4 bg-white/10 rounded-lg border border-white/20">
                <h3 className="text-white font-semibold mb-2">Printer Settings</h3>
                <ul className="text-white/80 text-sm space-y-1 list-disc list-inside">
                  <li>Recommended: Portrait orientation</li>
                  <li>Paper size: Letter (8.5" x 11")</li>
                  <li>Margins: Default or Narrow</li>
                  <li>Scale: 100% (default)</li>
                  <li>Background graphics: Enabled (if available)</li>
                </ul>
              </div>
            )}

            {/* Print Preview */}
            <div
              ref={printRef}
              className="bg-white p-8 print:p-4 mx-auto max-w-4xl"
              style={{ width: "8.5in" }}
            >
              {/* Header */}
              <div className="text-center mb-8 print:mb-6">
                {template.header.showYear && (
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>{template.header.yearLabel}:</strong> {team.year}
                  </p>
                )}
                {template.header.showSchoolName && team.schoolName && (
                  <p className="text-sm text-gray-600 mb-1">
                    <strong>{template.header.schoolNameLabel}:</strong> {team.schoolName}
                  </p>
                )}
                {template.header.showTeamName && (
                  <h1 className="text-3xl font-bold mt-2 text-black">{team.name}</h1>
                )}
              </div>

              {/* Roster Table */}
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
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Footer */}
              {(template.footer.showGeneratedDate || template.footer.customText) && (
                <div className="mt-8 text-center text-sm text-gray-600 print:mt-6">
                  {template.footer.showGeneratedDate && (
                    <p>Generated: {new Date(generatedAt).toLocaleDateString()}</p>
                  )}
                  {template.footer.customText && (
                    <p className="mt-2">{template.footer.customText}</p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 print:hidden">
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

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:p-4,
          .print\\:mb-6,
          .print\\:mt-6,
          .print\\:p-4 * {
            visibility: visible;
          }
          .print\\:p-4 {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            margin: 0.5in;
          }
        }
      `}</style>
    </>
  )
}
