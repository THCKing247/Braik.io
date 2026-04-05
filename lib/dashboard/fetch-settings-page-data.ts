import type { RequestUserLite } from "@/lib/auth/server-auth"
import type { getSupabaseServer } from "@/src/lib/supabaseServer"

type ServerSupabase = ReturnType<typeof getSupabaseServer>

type ProfilesRow = {
  id: string
  email: string | null
  full_name: string | null
  role: string | null
}

type TeamsRow = {
  id: string
  name: string | null
  slogan: string | null
  sport: string | null
  season_name: string | null
  logo_url: string | null
}

type CalendarSettingsRow = Record<string, unknown> & {
  id: string
  default_view?: string | null
  assistants_can_add_meetings?: boolean | null
  assistants_can_add_practices?: boolean | null
  assistants_can_edit_nonlocked?: boolean | null
  compact_view?: boolean | null
}

export type FetchSettingsPageBundleOptions = {
  /**
   * When set, skips a duplicate `profiles` read — auth already loaded role/team/full_name via `getRequestAuth()`.
   */
  authUser?: RequestUserLite
}

/**
 * One awaited batch for settings: profile plus optional team, calendar, roster ids.
 * Avoids sequential waterfalls (previously team → calendar → players).
 */
export async function fetchSettingsPageBundle(
  supabase: ServerSupabase,
  userId: string,
  teamId: string | undefined,
  options?: FetchSettingsPageBundleOptions
): Promise<{
  userProfile: ProfilesRow | null
  teamData: TeamsRow | null
  calendarSettings: CalendarSettingsRow | null
  players: Array<{ id: string }> | null
}> {
  if (options?.authUser) {
    const au = options.authUser
    const userProfile: ProfilesRow = {
      id: au.id,
      email: au.email,
      full_name: au.profileFullName ?? null,
      role: au.profileRoleDb ?? null,
    }
    if (!teamId) {
      return {
        userProfile,
        teamData: null,
        calendarSettings: null,
        players: null,
      }
    }

    const teamQuery = supabase
      .from("teams")
      .select("id, name, slogan, sport, season_name, logo_url")
      .eq("id", teamId)
      .maybeSingle()

    const calendarQuery = supabase.from("calendar_settings").select("*").eq("team_id", teamId).maybeSingle()

    const playersQuery = supabase.from("players").select("id").eq("team_id", teamId)

    const [{ data: teamData }, { data: calendarSettings }, { data: players }] = await Promise.all([
      teamQuery,
      calendarQuery,
      playersQuery,
    ])

    return {
      userProfile,
      teamData: teamData as TeamsRow | null,
      calendarSettings: calendarSettings as CalendarSettingsRow | null,
      players: (players as Array<{ id: string }> | null) ?? null,
    }
  }

  const profileQuery = supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .maybeSingle()

  if (!teamId) {
    const { data: userProfile } = await profileQuery
    return {
      userProfile: userProfile as ProfilesRow | null,
      teamData: null,
      calendarSettings: null,
      players: null,
    }
  }

  const teamQuery = supabase
    .from("teams")
    .select("id, name, slogan, sport, season_name, logo_url")
    .eq("id", teamId)
    .maybeSingle()

  const calendarQuery = supabase.from("calendar_settings").select("*").eq("team_id", teamId).maybeSingle()

  const playersQuery = supabase.from("players").select("id").eq("team_id", teamId)

  const [{ data: userProfile }, { data: teamData }, { data: calendarSettings }, { data: players }] =
    await Promise.all([profileQuery, teamQuery, calendarQuery, playersQuery])

  return {
    userProfile: userProfile as ProfilesRow | null,
    teamData: teamData as TeamsRow | null,
    calendarSettings: calendarSettings as CalendarSettingsRow | null,
    players: (players as Array<{ id: string }> | null) ?? null,
  }
}
