import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Resolve a season_id for game rows: prefer current calendar year, else latest season, else create current year.
 */
export async function resolveSeasonIdForTeam(supabase: SupabaseClient, teamId: string): Promise<string> {
  const currentYear = new Date().getFullYear()

  const { data: yearMatch, error: yErr } = await supabase
    .from("seasons")
    .select("id")
    .eq("team_id", teamId)
    .eq("year", currentYear)
    .maybeSingle()

  if (yErr) {
    console.error("[resolveSeasonIdForTeam] year lookup", yErr)
    throw new Error("Failed to resolve season")
  }
  if (yearMatch?.id) return yearMatch.id as string

  const { data: latest, error: lErr } = await supabase
    .from("seasons")
    .select("id")
    .eq("team_id", teamId)
    .order("year", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lErr) {
    console.error("[resolveSeasonIdForTeam] latest lookup", lErr)
    throw new Error("Failed to resolve season")
  }
  if (latest?.id) return latest.id as string

  const { data: inserted, error: insErr } = await supabase
    .from("seasons")
    .insert({
      team_id: teamId,
      year: currentYear,
      name: `${currentYear} season`,
    })
    .select("id")
    .single()

  if (insErr || !inserted?.id) {
    console.error("[resolveSeasonIdForTeam] insert", insErr)
    throw new Error("Failed to create season for games")
  }

  return inserted.id as string
}
