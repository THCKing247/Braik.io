"use client"

interface Team {
  id: string
  seasonName: string
  seasonStart: Date
  seasonEnd: Date
}

export function SeasonSettings({ team }: { team: Team }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Season</h2>
      <p className="text-sm text-white/80">{team.seasonName}</p>
    </div>
  )
}
