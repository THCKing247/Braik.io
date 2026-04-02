import Link from "next/link"

export default function AdminTeamNotFound() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold text-zinc-100">Team not found</p>
      <p className="max-w-md text-sm text-zinc-400">No team exists for this ID, or it was removed.</p>
      <Link href="/admin/teams" className="text-sm text-cyan-300 underline hover:text-cyan-200">
        Back to teams
      </Link>
    </div>
  )
}
