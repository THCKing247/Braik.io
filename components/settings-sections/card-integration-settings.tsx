"use client"

export function CardIntegrationSettings({ teamId }: { teamId: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Card Integration</h2>
      <p className="text-sm text-white/80">Team: {teamId}</p>
    </div>
  )
}
