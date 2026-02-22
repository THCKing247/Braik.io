"use client"

interface Team {
  id: string
  name: string
  slogan: string | null
  sport: string
  seasonName: string
  organization: { name: string }
}

export function TeamSettingsSection({ team }: { team: Team }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Team</h2>
      <p className="text-sm text-white/80">{team.name}</p>
    </div>
  )
}
