"use client"

import Link from "next/link"
import { AdTeamStatusBadge } from "./ad-team-status-badge"

export type TeamRow = {
  id: string
  name: string
  sport: string | null
  rosterSize: number | null
  createdAt: string
  headCoachName: string | null
  invitePending: boolean
}

interface AdTeamsTableProps {
  teams: TeamRow[]
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return "Not set"
  }
}

export function AdTeamsTable({ teams }: AdTeamsTableProps) {
  if (teams.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E5E7EB]">
          <thead className="bg-[#F9FAFB]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Team
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Sport
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Roster size
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Head coach
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Created
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] bg-white">
            {teams.map((team) => {
              const status = team.headCoachName
                ? "assigned"
                : team.invitePending
                  ? "pending"
                  : "none"
              return (
                <tr key={team.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-[#212529]">{team.name}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">
                    {team.sport?.trim() ? team.sport : "Not set"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">
                    {team.rosterSize != null ? team.rosterSize : "Not set"}
                  </td>
                  <td className="px-4 py-3">
                    <AdTeamStatusBadge
                      status={status}
                      coachName={team.headCoachName}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">
                    {formatDate(team.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <Link
                      href={`/dashboard/ad/teams/${team.id}`}
                      className="text-[#3B82F6] hover:underline font-medium"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
