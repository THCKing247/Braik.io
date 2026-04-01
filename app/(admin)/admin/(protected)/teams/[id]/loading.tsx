export default function AdminTeamDetailLoading() {
  return (
    <div className="space-y-6 p-6 animate-pulse" aria-busy="true" aria-label="Loading team">
      <div className="h-8 w-48 rounded bg-white/10" />
      <div className="h-4 w-72 rounded bg-white/10" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 rounded-xl border border-white/10 bg-white/5" />
        <div className="h-40 rounded-xl border border-white/10 bg-white/5" />
      </div>
      <div className="h-32 rounded-xl border border-white/10 bg-white/5" />
    </div>
  )
}
