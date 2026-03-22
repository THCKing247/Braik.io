import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { AdEmptyState } from "@/components/portal/ad/ad-empty-state"
import { AdCoachesTable } from "@/components/portal/ad/ad-coaches-table"
import { fetchAdPrimaryHeadCoaches } from "@/lib/ad-primary-head-coaches"

export const dynamic = "force-dynamic"

export default async function AdCoachesPage() {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
  const { coaches } = await fetchAdPrimaryHeadCoaches(supabase, session.user.id, session.user.role ?? null)

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#212529]">Coaches</h1>
          <p className="mt-1 text-[#6B7280]">View and manage coaches across your department.</p>
        </div>
      </div>

      {coaches.length === 0 ? (
        <AdEmptyState
          title="No head coaches yet"
          description="Primary head coaches appear here from team memberships in your visible teams. Assign a primary head coach on each team or invite a head coach when you create or edit a team."
        />
      ) : (
        <AdCoachesTable coaches={coaches} />
      )}
    </div>
  )
}
