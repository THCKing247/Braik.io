export default function AdminTeamsLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading teams">
      <div className="h-10 w-64 rounded-lg bg-white/10" />
      <div className="grid gap-3 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-white/10 bg-[#18181c]" />
        ))}
      </div>
      <div className="h-32 rounded-xl border border-white/10 bg-[#18181c]" />
    </div>
  )
}
