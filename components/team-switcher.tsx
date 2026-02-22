"use client"

import { useRouter, usePathname } from "next/navigation"

interface Team {
  id: string
  name: string
  organization: { name: string }
  sport: string
  seasonName: string
}

export function TeamSwitcher({
  teams,
  currentTeamId,
}: {
  teams: Team[]
  currentTeamId: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const teamId = e.target.value
    const url = `${pathname}?teamId=${encodeURIComponent(teamId)}`
    router.push(url)
  }

  return (
    <select
      value={currentTeamId}
      onChange={handleChange}
      className="text-sm border rounded px-2 py-1.5 bg-white"
      style={{ color: "rgb(var(--text))", borderColor: "rgb(var(--border))" }}
      aria-label="Switch team"
    >
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  )
}
