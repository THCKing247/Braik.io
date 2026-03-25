import { redirect } from "next/navigation"
import { getCachedServerSession } from "@/lib/auth/cached-server-session"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getAdPortalTabVisibility, resolveFootballAdAccessState } from "@/lib/enforcement/football-ad-access"

export const dynamic = "force-dynamic"

export default async function AdSettingsPage() {
  const session = await getCachedServerSession()
  if (!session?.user?.id) return null

  const supabase = getSupabaseServer()
  const footballAccess = await resolveFootballAdAccessState(supabase, session.user.id)
  if (!getAdPortalTabVisibility(footballAccess).showSettings) {
    redirect("/dashboard/ad/teams")
  }

  let school: { name: string; city: string | null; state: string | null; school_type: string | null; mascot: string | null; website: string | null } | null = null
  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", session.user.id)
    .maybeSingle()
  if (profile?.school_id) {
    const { data } = await supabase
      .from("schools")
      .select("name, city, state, school_type, mascot, website")
      .eq("id", profile.school_id)
      .single()
    school = data
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#212529]">Department settings</h1>
        <p className="mt-1 text-[#6B7280]">Manage your school and athletic department information.</p>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-[#212529]">School information</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">School name</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">Type</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.school_type ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">City</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.city ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">State</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.state ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">Mascot</dt>
            <dd className="mt-1 text-sm text-[#212529]">{school?.mascot ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-[#6B7280]">Website</dt>
            <dd className="mt-1 text-sm text-[#212529]">
              {school?.website ? (
                <a href={school.website} target="_blank" rel="noopener noreferrer" className="text-[#3B82F6] hover:underline">
                  {school.website}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-[#6B7280]">Editable school and billing settings will be available in a future update.</p>
      </div>
    </div>
  )
}
