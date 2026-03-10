"use client"

import { useState, useEffect, useRef } from "react"
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
          setRosterData(data)
        } else {
          alert("Failed to load roster data")
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
    window.print()
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

  return (
    <div className="space-y-4">
      {/* Print controls - hidden when printing */}
      <div className="flex gap-3 print:hidden">
        <Button onClick={handlePrint}>Print Roster</Button>
        <Button onClick={handleEmail} variant="outline">Email Roster</Button>
        <Button onClick={onClose} variant="outline">Close</Button>
      </div>

      {/* Roster content */}
      <div ref={printRef} className="bg-white p-8 print:p-4">
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
            <h1 className="text-3xl font-bold mt-2">{team.name}</h1>
          )}
        </div>

        {/* Roster Table */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100">
              {template.body.showJerseyNumber && (
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                  {template.body.jerseyNumberLabel}
                </th>
              )}
              {template.body.showPlayerName && (
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                  {template.body.playerNameLabel}
                </th>
              )}
              {template.body.showGrade && (
                <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                  {template.body.gradeLabel}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {players.map((player, idx) => (
              <tr key={idx}>
                {template.body.showJerseyNumber && (
                  <td className="border border-gray-300 px-4 py-2">
                    {player.jerseyNumber ?? ""}
                  </td>
                )}
                {template.body.showPlayerName && (
                  <td className="border border-gray-300 px-4 py-2">
                    {player.name}
                  </td>
                )}
                {template.body.showGrade && (
                  <td className="border border-gray-300 px-4 py-2">
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

      {/* Print styles */}
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
        }
      `}</style>
    </div>
  )
}
