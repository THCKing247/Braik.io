"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { Button } from "@/components/ui/button"

interface RosterPrintViewProps {
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

export function RosterPrintView({ teamId, onClose }: RosterPrintViewProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [rosterData, setRosterData] = useState<RosterData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRoster = async () => {
      try {
        const response = await fetch(`/api/roster/print?teamId=${teamId}`)
        if (response.ok) {
          const data = await response.json()
          console.log("[roster-print-view] API response payload", {
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
    console.log("[roster-print-view] handlePrint", {
      printRefExists: !!el,
      playerCount: players.length,
      templateExists: !!rosterData?.template,
    })
    if (!el) {
      console.warn("[roster-print-view] Print aborted: printable container ref not mounted")
      return
    }
    if (!rosterData) {
      console.warn("[roster-print-view] Print aborted: no roster data")
      return
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
  }

  const handleEmail = async () => {
    const email = prompt("Enter email address to send roster to:")
    if (!email) return

    try {
      const response = await fetch("/api/roster/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          recipientEmail: email,
        }),
      })

      if (response.ok) {
        alert("Roster email sent successfully!")
      } else {
        const error = await response.json()
        alert(error.error || "Failed to send email")
      }
    } catch (error) {
      console.error("Failed to send email:", error)
      alert("Failed to send email")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Loading roster...</p>
      </div>
    )
  }

  if (!rosterData) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Failed to load roster data</p>
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
    <div className="space-y-4">
      <div className="no-print flex gap-3">
        <Button onClick={handlePrint}>Print Roster</Button>
        <Button onClick={handleEmail} variant="outline">Email Roster</Button>
        <Button onClick={onClose} variant="outline">Close</Button>
      </div>

      <div className="roster-print-root bg-white p-8 text-black">
        {printBody}
      </div>

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
            <div ref={printRef} className="roster-print-root bg-white p-8 text-black">
              {printBody}
            </div>
          </div>,
          document.body
        )}

      <style jsx global>{`
        @media print {
          @page {
            margin: 0 !important;
            size: auto;
          }
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
    </div>
  )
}
