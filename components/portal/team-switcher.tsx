"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { buildDashboardTeamPath } from "@/lib/navigation/organization-routes"

interface Team {
  id: string
  name: string
  organizationPortalUuid?: string | null
  shortTeamId?: string | null
  organization: {
    name: string
  }
  sport: string
  seasonName: string
}

export function TeamSwitcher({ teams, currentTeamId }: { teams: Team[]; currentTeamId: string }) {
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState(currentTeamId)

  const canonicalTeamHref = (team: Team): string => {
    if (team.organizationPortalUuid && team.shortTeamId) {
      return buildDashboardTeamPath({
        organizationPortalUuid: team.organizationPortalUuid,
        shortTeamId: team.shortTeamId,
      })
    }
    return `/dashboard?teamId=${encodeURIComponent(team.id)}`
  }

  useEffect(() => {
    setSelectedTeamId(currentTeamId)
  }, [currentTeamId])

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId)
    const nextTeam = teams.find((team) => team.id === teamId)
    if (!nextTeam) return
    router.push(canonicalTeamHref(nextTeam))
    router.refresh()
  }

  if (teams.length <= 1) {
    return null
  }

  const currentTeam = teams.find((t) => t.id === currentTeamId)

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedTeamId}
        onChange={(e) => handleTeamChange(e.target.value)}
        className="flex h-9 rounded-md border px-3 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0"
        style={{
          backgroundColor: '#FFFFFF',
          color: '#111827',
          borderColor: '#CBD5E1',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#F1F5F9'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#FFFFFF'
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = 'none'
          e.currentTarget.style.boxShadow = '0 0 0 2px #1e3a5f'
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {teams.map((team) => (
          <option 
            key={team.id} 
            value={team.id}
            style={{
              backgroundColor: '#FFFFFF',
              color: '#111827',
            }}
          >
            {team.organization.name} - {team.name} ({team.seasonName})
          </option>
        ))}
      </select>
    </div>
  )
}
