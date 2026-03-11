import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { redirect } from "next/navigation"
import { SettingsLayout } from "@/components/portal/settings-layout"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const supabase = getSupabaseServer()
  const userId = session.user.id
  const teamId = session.user.teamId

  // Fetch user data
  const { data: userProfile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle()

  if (!userProfile) {
    redirect("/login")
  }

  const user = {
    id: userProfile.id,
    email: userProfile.email || session.user.email || "",
    name: userProfile.full_name,
    image: null,
  }

  // Fetch team data if user has a team
  let team = null
  if (teamId) {
    const { data: teamData } = await supabase
      .from("teams")
      .select("id, name, slogan, sport, season_name, logo_url")
      .eq("id", teamId)
      .maybeSingle()

    if (teamData) {
      const { data: calendarSettings } = await supabase
        .from("calendar_settings")
        .select("*")
        .eq("team_id", teamId)
        .maybeSingle()

      const { data: players } = await supabase
        .from("players")
        .select("id")
        .eq("team_id", teamId)

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
        primaryColor: null,
        secondaryColor: null,
        organization: { name: teamData.name || "" },
        calendarSettings: calendarSettings
          ? {
              id: calendarSettings.id,
              defaultView: calendarSettings.default_view || "week",
              assistantsCanAddMeetings: calendarSettings.assistants_can_add_meetings ?? true,
              assistantsCanAddPractices: calendarSettings.assistants_can_add_practices ?? false,
              assistantsCanEditNonlocked: calendarSettings.assistants_can_edit_nonlocked ?? false,
              compactView: calendarSettings.compact_view ?? false,
            }
          : null,
        players: players || [],
      }
    }
  }

  // If no team but user is head coach, redirect to onboarding
  if (!team && session.user.role?.toUpperCase() === "HEAD_COACH") {
    redirect("/onboarding")
  }

  return (
    <SettingsLayout
      user={user}
      team={team || {
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
        primaryColor: null,
        secondaryColor: null,
        organization: { name: "" },
        calendarSettings: null,
        players: [],
      }}
      userRole={session.user.role || ""}
    />
  )
}
