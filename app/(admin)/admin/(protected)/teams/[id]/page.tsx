import Link from "next/link"
import { notFound } from "next/navigation"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { loadAdminTeamDetail } from "@/lib/admin/admin-team-detail"
import { AdminTeamDetailView } from "@/components/admin/admin-team-detail-view"

export default async function AdminTeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params
  const supabase = getSupabaseServer()

  try {
    const detail = await loadAdminTeamDetail(supabase, teamId)
    if (!detail) {
      notFound()
    }
    return <AdminTeamDetailView detail={detail} />
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load team"
    console.error("[admin/team-detail] page load error", { teamId, message })
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6">
        <div className="max-w-lg rounded-xl border border-red-400/40 bg-red-500/15 p-6 text-center">
          <p className="font-semibold text-red-100">Could not load team</p>
          <p className="mt-2 text-sm text-red-100/90">{message}</p>
          <Link href="/admin/teams" className="mt-4 inline-block text-sm text-cyan-300 underline hover:text-cyan-200">
            Back to teams
          </Link>
        </div>
      </div>
    )
  }
}
