"use client"

import Link from "next/link"
import { AdTeamStatusBadge } from "./ad-team-status-badge"

export type TeamRow = {
  id: string
  name: string
  /** For filters only — not shown as its own column. */
  sport: string | null
  genderLabel: string
  levelLabel: string
  rosterSize: number | null
  headCoachName: string | null
  creatorName: string | null
  createdAt: string
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
    return "—"
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
                Gender
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Team
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Level
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Head coach
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Roster size
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Creator
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Date created
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
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{team.genderLabel}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-[#212529]">{team.name}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{team.levelLabel}</td>
                  <td className="px-4 py-3">
                    <AdTeamStatusBadge
                      status={status}
                      coachName={team.headCoachName}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">
                    {team.rosterSize != null ? team.rosterSize : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">
                    {team.creatorName?.trim() ? team.creatorName : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6B7280]">{formatDate(team.createdAt)}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex flex-wrap justify-end gap-3">
                      <Link
                        href={`/dashboard?teamId=${encodeURIComponent(team.id)}`}
                        // Heavy team-scoped dashboard route: disable Link prefetch so hover does not fetch RSC/bootstrap.
                        prefetch={false}
                        className="text-[#3B82F6] hover:underline font-medium"
                      >
                        Portal access
                      </Link>
                      <Link
                        href={`/dashboard/ad/teams/${team.id}`}
                        className="text-[#3B82F6] hover:underline font-medium"
                      >
                        Edit
                      </Link>
                    </div>
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

const SKELETON_HEADERS = [
  "Gender",
  "Team",
  "Level",
  "Head coach",
  "Roster size",
  "Creator",
  "Date created",
  "Actions",
] as const

/** Placeholder rows for loading states — matches real columns (teams list is normally server-rendered). */
export function AdTeamsTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E5E7EB]">
          <thead className="bg-[#F9FAFB]">
            <tr>
              {SKELETON_HEADERS.map((label, i) => (
                <th
                  key={label}
                  className={`px-4 py-3 text-xs font-semibold text-[#6B7280] uppercase tracking-wider ${
                    i === SKELETON_HEADERS.length - 1 ? "text-right" : "text-left"
                  }`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] bg-white">
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className="animate-pulse">
                {SKELETON_HEADERS.map((label, c) => (
                  <td key={`${r}-${label}`} className="px-4 py-3">
                    <div
                      className={`h-4 rounded bg-[#E5E7EB] ${c === 1 ? "max-w-[12rem]" : c === SKELETON_HEADERS.length - 1 ? "ml-auto max-w-[6rem]" : "max-w-[5rem]"}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
