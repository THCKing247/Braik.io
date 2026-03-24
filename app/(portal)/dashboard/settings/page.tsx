import { Suspense } from "react"
import { getCachedServerSession } from "@/lib/auth/cached-server-session"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { redirect } from "next/navigation"
import { fetchSettingsPageBundle } from "@/lib/dashboard/fetch-settings-page-data"
import { SettingsLayout } from "@/components/portal/settings-layout"
import { SettingsPageSkeleton } from "@/components/portal/dashboard-route-skeletons"

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsPageSkeleton />}>
      <SettingsPageContent />
    </Suspense>
  )
}

async function SettingsPageContent() {
  const session = await getCachedServerSession()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const supabase = getSupabaseServer()
  const { userProfile, teamData, calendarSettings, players } = await fetchSettingsPageBundle(
    supabase,
    session.user.id,
    session.user.teamId
  )

  if (!userProfile) {
    redirect("/login")
  }

  const user = {
    id: userProfile.id,
    email: userProfile.email || session.user.email || "",
    name: userProfile.full_name,
    image: null,
  }

  let team: {
    id: string
    name: string
    slogan: string | null
    sport: string
    seasonName: string
    seasonStart: Date
    seasonEnd: Date
    rosterCap: number
    duesAmount: number
    duesDueDate: Date | null
    logoUrl: string | null
    organization: { name: string }
    calendarSettings: {
      id: string
      defaultView: string
      assistantsCanAddMeetings: boolean
      assistantsCanAddPractices: boolean
      assistantsCanEditNonlocked: boolean
      compactView: boolean
    } | null
    players: Array<{ id: string }>
  } | null = null

  if (teamData) {
    team = {
      id: teamData.id,
      name: teamData.name || "",
      slogan: teamData.slogan,
      sport: teamData.sport || "football",
      seasonName: teamData.season_name || "",
      seasonStart: new Date(),
      seasonEnd: new Date(),
      rosterCap: 0,
      duesAmount: 0,
      duesDueDate: null,
      logoUrl: teamData.logo_url,
      organization: { name: teamData.name || "" },
      calendarSettings: calendarSettings
        ? {
            id: calendarSettings.id,
            defaultView: (calendarSettings.default_view as string) || "week",
            assistantsCanAddMeetings: calendarSettings.assistants_can_add_meetings ?? true,
            assistantsCanAddPractices: calendarSettings.assistants_can_add_practices ?? false,
            assistantsCanEditNonlocked: calendarSettings.assistants_can_edit_nonlocked ?? false,
            compactView: calendarSettings.compact_view ?? false,
          }
        : null,
      players: players || [],
    }
  }

  if (!team && session.user.role?.toUpperCase() === "HEAD_COACH") {
    redirect("/onboarding")
  }

  return (
    <SettingsLayout
      user={user}
      team={
        team ?? {
          id: "",
          name: "",
          slogan: null,
          sport: "football",
          seasonName: "",
          seasonStart: new Date(),
          seasonEnd: new Date(),
          rosterCap: 0,
          duesAmount: 0,
          duesDueDate: null,
          logoUrl: null,
          organization: { name: "" },
          calendarSettings: null,
          players: [],
        }
      }
      userRole={session.user.role || ""}
    />
  )
}
